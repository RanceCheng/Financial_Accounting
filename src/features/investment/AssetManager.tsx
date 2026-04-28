import { useState, useMemo, Fragment, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { Asset, AssetLot } from '@/data/types'
import { v4 as uuidv4 } from 'uuid'
import { assetRepo } from '@/data/repositories'
import { AssetSchema, AssetInput } from '@/data/schemas'
import { ASSET_TYPES, MARKETS, CURRENCIES, ASSET_TYPE_LABELS, MARKET_LABELS } from '@/lib/constants'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SortTh } from '@/components/common/SortTh'
import { useSortable, sortByKey } from '@/lib/sorting'
import { Plus, Edit2, Trash2, RefreshCw, ExternalLink, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

// Google Finance URL (for manual reference)
function toGoogleFinanceUrl(ticker: string, market: string): string {
  const marketCode: Record<string, string> = {
    TW: 'TPE', US: 'NASDAQ', JP: 'TYO', CN: 'SHA',
  }
  const code = marketCode[market]
  if (!code) return `https://www.google.com/finance/search?q=${ticker}`
  return `https://www.google.com/finance/quote/${ticker}:${code}`
}

// --- Source 1: TWSE official real-time API (台股上市, no CORS) ---
async function fetchViaTWSE(ticker: string): Promise<number> {
  for (const ex of ['tse', 'otc']) {
    try {
      const res = await fetch(
        `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${ex}_${ticker}.tw`,
        { cache: 'no-store' }
      )
      if (!res.ok) continue
      const data = await res.json()
      const item = data?.msgArray?.[0]
      if (!item) continue
      // z = realtime price, y = prev close (z is "-" when market closed)
      const raw = item.z !== '-' ? item.z : item.y
      const price = parseFloat(raw)
      if (!isNaN(price) && price > 0) return price
    } catch { continue }
  }
  throw new Error('twse-fail')
}

// --- Source 2: Yahoo Finance via CORS proxies (verified working proxies only) ---
async function fetchWithTimeout(url: string, ms = 20000): Promise<Response> {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
  } finally {
    clearTimeout(id)
  }
}

// Extract price from possibly-wrapped JSON (handles allorigins /get format)
function extractYahooPrice(text: string): number | null {
  let data: any
  try { data = JSON.parse(text) } catch { return null }
  // Direct Yahoo chart response
  const direct = data?.chart?.result?.[0]?.meta?.regularMarketPrice
  if (direct != null && direct > 0) return direct
  // allorigins /get wraps in { contents: "..." }
  if (typeof data?.contents === 'string') {
    try {
      const inner = JSON.parse(data.contents)
      const p = inner?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (p != null && p > 0) return p
    } catch { /* ignore */ }
  }
  return null
}

async function fetchViaYahoo(ticker: string, market: string): Promise<number> {
  const suffix: Record<string, string> = { TW: '.TW', JP: '.T', CN: '.SS', US: '' }
  const symbol = `${ticker}${suffix[market] ?? ''}`
  const params = `?interval=1d&range=2d`

  // 1st: Vite dev-server proxy → no CORS, most reliable in dev mode
  const viteProxy = `/api/yahoo-finance/v8/finance/chart/${symbol}${params}`
  // 2nd & 3rd: CORS proxies for production / static builds
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${params}`
  const corsProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`,
  ]

  const allEndpoints = [viteProxy, ...corsProxies]

  for (const endpoint of allEndpoints) {
    try {
      const res = await fetchWithTimeout(endpoint, 20000)
      if (!res.ok) continue
      const text = await res.text()
      const price = extractYahooPrice(text)
      if (price != null) return price
    } catch { continue }
  }
  throw new Error('yahoo-fail')
}

// --- Source 3: Stooq CSV via CORS proxy ---
// Fund: ticker is the full Yahoo Finance symbol (e.g. 0P0001EHG8.F), send as-is
async function fetchViaFundYahoo(symbol: string): Promise<number> {
  const params = `?interval=1d&range=2d`
  const viteProxy = `/api/yahoo-finance/v8/finance/chart/${encodeURIComponent(symbol)}${params}`
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}${params}`
  const corsProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`,
  ]
  for (const endpoint of [viteProxy, ...corsProxies]) {
    try {
      const res = await fetchWithTimeout(endpoint, 20000)
      if (!res.ok) continue
      const text = await res.text()
      const price = extractYahooPrice(text)
      if (price != null) return price
    } catch { continue }
  }
  throw new Error('fund-yahoo-fail')
}

async function fetchViaStooq(ticker: string, market: string): Promise<number> {
  const suffix: Record<string, string> = { TW: '.tw', JP: '.jp', US: '.us', CN: '.cn' }
  const symbol = `${ticker.toLowerCase()}${suffix[market] ?? ''}`
  const stooqUrl = `https://stooq.com/q/d/l/?s=${symbol}&i=d`

  const viteProxy = `/api/stooq/q/d/l/?s=${symbol}&i=d`
  const corsProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(stooqUrl)}`,
  ]
  const allEndpoints = [viteProxy, ...corsProxies]

  for (const endpoint of allEndpoints) {
    try {
      const res = await fetch(endpoint)
      if (!res.ok) continue
      const text = await res.text()
      const lines = text.trim().split('\n').filter(Boolean)
      // header: Date,Open,High,Low,Close,Volume — take last data row, Close = index 4
      if (lines.length < 2) continue
      const cols = lines[lines.length - 1].split(',')
      const price = parseFloat(cols[4])
      if (!isNaN(price) && price > 0) return price
    } catch { continue }
  }
  throw new Error('stooq-fail')
}

async function fetchPrice(ticker: string, market: string, assetType?: string): Promise<number> {
  const errors: string[] = []

  // 基金：優先處理（不受市場限制）
  if (assetType === 'fund') {
    if (!ticker.trim()) throw new Error('請填入 Yahoo Finance 基金代碼（如 0P0001EHG8.F）')
    return fetchViaFundYahoo(ticker.trim())
  }

  // 其他/現金市場不支援自動抓價
  if (market === 'OTHER' || market === 'CASH') {
    throw new Error('此市場不支援自動取得現價')
  }

  // Taiwan: TWSE official API is most reliable
  if (market === 'TW') {
    try { return await fetchViaTWSE(ticker) } catch (e) { errors.push(`TWSE: ${e}`) }
  }

  // Yahoo Finance (all markets)
  try { return await fetchViaYahoo(ticker, market) } catch (e) { errors.push(`Yahoo: ${e}`) }

  // Stooq fallback (TW/JP/US/CN)
  try { return await fetchViaStooq(ticker, market) } catch (e) { errors.push(`Stooq: ${e}`) }

  throw new Error(`所有來源均無法取得：${errors.join(' | ')}`)
}

// 從批次列表計算加權平均買入價格與數量總和
function calcLotsStats(lots: AssetLot[]): { quantity: number | undefined; buyPrice: number; fxRateToBase: number | undefined } {
  const totalQty = lots.reduce((s, l) => s + (l.quantity ?? 0), 0)
  const withBoth = lots.filter(l => l.quantity != null && l.quantity > 0 && l.buyPrice != null)
  const weightedSum = withBoth.reduce((s, l) => s + l.buyPrice! * l.quantity!, 0)
  const qtyForWA = withBoth.reduce((s, l) => s + l.quantity!, 0)
  const withFx = lots.filter(l => l.fxRateToBase != null && l.fxRateToBase > 0 && (l.quantity ?? 0) > 0)
  const fxWeightedSum = withFx.reduce((s, l) => s + l.fxRateToBase! * (l.quantity ?? 0), 0)
  const fxQty = withFx.reduce((s, l) => s + (l.quantity ?? 0), 0)
  return {
    quantity: totalQty > 0 ? totalQty : undefined,
    buyPrice: qtyForWA > 0 ? weightedSum / qtyForWA : 0,
    fxRateToBase: fxQty > 0 ? parseFloat((fxWeightedSum / fxQty).toFixed(4)) : undefined,
  }
}

function formatLotDate(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const emptyForm = (): AssetInput => ({
  name: '',
  ticker: '',
  assetType: 'tw_stock',
  market: 'TW',
  currency: 'TWD',
  quantity: undefined,
  buyPrice: 0,
  note: '',
})

export function AssetManager() {
  const assets = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const exchangeRate = useLiveQuery(() => db.exchangeRates.get('current'), [])
  const { sortKey, sortDir, handleSort } = useSortable('quantity', 'desc')
  const sorted = useMemo(() => sortByKey(assets, sortKey, sortDir, (a, key) => {
    switch (key) {
      case 'name': return a.name
      case 'ticker': return a.ticker
      case 'assetType': return ASSET_TYPE_LABELS[a.assetType]
      case 'market': return MARKET_LABELS[a.market]
      case 'currency': return a.currency
      case 'quantity': return a.quantity ?? -1
      case 'unrealizedPnl': {
        const pnl = a.currentPrice != null && a.buyPrice != null && a.quantity != null
          ? (a.currentPrice - a.buyPrice) * a.quantity
          : -Infinity
        return pnl
      }
      case 'buyPrice': return a.buyPrice ?? -1
      case 'currentPrice': return a.currentPrice ?? -1
      default: return ''
    }
  }), [assets, sortKey, sortDir])

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Asset | null>(null)
  const [form, setForm] = useState<AssetInput>(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 一次性轉移：將所有 buyPrice 為 null/undefined 的資產改為 0
  useEffect(() => {
    if (assets.length === 0) return
    const toFix = assets.filter(a => a.buyPrice == null)
    if (toFix.length === 0) return
    Promise.all(toFix.map(a => assetRepo.update(a.id, { buyPrice: 0 })))
  }, [assets])
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Lot edit/delete state
  type LotEditTarget = { asset: Asset; lot: import('@/data/types').AssetLot }
  const [lotEditTarget, setLotEditTarget] = useState<LotEditTarget | null>(null)
  const [lotForm, setLotForm] = useState({ name: '', buyPrice: '' as string, fxRateToBase: '' as string, buyDate: '', quantity: '' as string })
  const [lotDeleteTarget, setLotDeleteTarget] = useState<LotEditTarget | null>(null)

  const openLotEdit = (asset: Asset, lot: import('@/data/types').AssetLot) => {
    setLotEditTarget({ asset, lot })
    const getFxStr = () => {
      if (lot.fxRateToBase != null && lot.fxRateToBase > 0) return String(lot.fxRateToBase)
      if (asset.currency === 'TWD') return '1'
      if (asset.currency === 'USD' && exchangeRate?.usdRate) return String(exchangeRate.usdRate)
      if (asset.currency === 'JPY' && exchangeRate?.jpyRate) return String(exchangeRate.jpyRate)
      if (asset.currency === 'CNY' && exchangeRate?.cnyRate) return String(exchangeRate.cnyRate)
      return ''
    }
    setLotForm({
      name: lot.name,
      buyPrice: lot.buyPrice != null ? String(lot.buyPrice) : '',
      fxRateToBase: getFxStr(),
      buyDate: lot.buyDate.slice(0, 16),
      quantity: lot.quantity != null ? String(lot.quantity) : '',
    })
  }

  const handleLotSave = async () => {
    if (!lotEditTarget) return
    const { asset, lot } = lotEditTarget
    const getFallbackFx = () => {
      if (asset.currency === 'TWD') return 1
      if (asset.currency === 'USD' && exchangeRate?.usdRate) return exchangeRate.usdRate
      if (asset.currency === 'JPY' && exchangeRate?.jpyRate) return exchangeRate.jpyRate
      if (asset.currency === 'CNY' && exchangeRate?.cnyRate) return exchangeRate.cnyRate
      return undefined
    }
    const updatedLots = (asset.lots ?? []).map(l =>
      l.id === lot.id
        ? {
            ...l,
            name: lotForm.name,
            buyPrice: lotForm.buyPrice !== '' ? Number(lotForm.buyPrice) : 0,
            fxRateToBase: lotForm.fxRateToBase !== '' ? Number(lotForm.fxRateToBase) : (l.fxRateToBase ?? getFallbackFx()),
            buyDate: lotForm.buyDate ? new Date(lotForm.buyDate).toISOString() : l.buyDate,
            quantity: lotForm.quantity !== '' ? Number(lotForm.quantity) : undefined,
          }
        : l
    )
    const { quantity, buyPrice, fxRateToBase: calcedFxRate } = calcLotsStats(updatedLots)
    const fxRateToBase = calcedFxRate ?? getFallbackFx()
    await assetRepo.update(asset.id, { lots: updatedLots, quantity, buyPrice, fxRateToBase })
    setLotEditTarget(null)
  }

  const handleLotDelete = async () => {
    if (!lotDeleteTarget) return
    const { asset, lot } = lotDeleteTarget
    const updatedLots = (asset.lots ?? []).filter(l => l.id !== lot.id)
    const { quantity, buyPrice, fxRateToBase: calcedFxRate } = calcLotsStats(updatedLots)
    const getFallbackFx = () => {
      if (asset.currency === 'TWD') return 1
      if (asset.currency === 'USD' && exchangeRate?.usdRate) return exchangeRate.usdRate
      if (asset.currency === 'JPY' && exchangeRate?.jpyRate) return exchangeRate.jpyRate
      if (asset.currency === 'CNY' && exchangeRate?.cnyRate) return exchangeRate.cnyRate
      return undefined
    }
    const fxRateToBase = calcedFxRate ?? getFallbackFx()
    await assetRepo.update(asset.id, { lots: updatedLots, quantity, buyPrice, fxRateToBase })
    setLotDeleteTarget(null)
  }

  // Price update state
  const [priceAsset, setPriceAsset] = useState<Asset | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [fetchMsg, setFetchMsg] = useState('')

  const openPriceUpdate = (a: Asset) => {
    setPriceAsset(a)
    setPriceInput(a.currentPrice != null ? String(a.currentPrice) : '')
    setFetchStatus('idle')
    setFetchMsg('')
  }

  const handleAutoFetch = async () => {
    if (!priceAsset) return
    setFetchStatus('loading')
    setFetchMsg('')
    try {
      const price = await fetchPrice(priceAsset.ticker, priceAsset.market, priceAsset.assetType)
      setPriceInput(String(price))
      setFetchStatus('success')
      setFetchMsg(`取得成功：${price}`)
    } catch (e) {
      setFetchStatus('error')
      setFetchMsg(`無法自動取得：${e instanceof Error ? e.message : '未知錯誤'}`)
    }
  }

  const handlePriceSave = async () => {
    if (!priceAsset) return
    const val = parseFloat(priceInput)
    if (isNaN(val) || val < 0) return
    const update: Partial<import('@/data/schemas').AssetInput> = { currentPrice: val }
    if (priceAsset.lots && priceAsset.lots.length > 0) {
      const { quantity, buyPrice } = calcLotsStats(priceAsset.lots)
      update.quantity = quantity
      update.buyPrice = buyPrice
    }
    await assetRepo.update(priceAsset.id, update)
    setPriceAsset(null)
  }

  // Bulk price update state
  type BulkResult = { name: string; ticker: string; status: 'success' | 'error' | 'skip'; price?: number }
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([])

  const handleBulkUpdate = async () => {
    // 基金不受市場限制；排除現金及無 ticker 的其他市場資產
    const targets = assets.filter((a) =>
      a.assetType === 'fund' ? !!a.ticker.trim() : (a.market !== 'CASH' && a.market !== 'OTHER')
    )
    setBulkResults([])
    setBulkRunning(true)
    const results: BulkResult[] = []
    for (const a of targets) {
      try {
        const price = await fetchPrice(a.ticker, a.market, a.assetType)
        const update: Partial<import('@/data/schemas').AssetInput> = { currentPrice: price }
        if (a.lots && a.lots.length > 0) {
          const { quantity, buyPrice } = calcLotsStats(a.lots)
          update.quantity = quantity
          update.buyPrice = buyPrice
        }
        await assetRepo.update(a.id, update)
        results.push({ name: a.name, ticker: a.ticker, status: 'success', price })
      } catch {
        results.push({ name: a.name, ticker: a.ticker, status: 'error' })
      }
      setBulkResults([...results])
    }
    // 跳過清單：不在 targets 中的資產（避免重複）
    const targetIds = new Set(targets.map((a) => a.id))
    assets.filter((a) => !targetIds.has(a.id)).forEach((a) => {
      results.push({ name: a.name, ticker: a.ticker, status: 'skip' })
    })
    setBulkResults([...results])
    setBulkRunning(false)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm())
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item: Asset) => {
    setEditItem(item)
    setForm({
      name: item.name,
      ticker: item.ticker,
      assetType: item.assetType,
      market: item.market,
      currency: item.currency,
      quantity: item.quantity,
      buyPrice: item.buyPrice,
      currentPrice: item.currentPrice,
      note: item.note ?? '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleSave = async () => {
    const result = AssetSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e: { path: (string | number)[]; message: string }) => { errs[e.path[0]] = e.message })
      setErrors(errs)
      return
    }
    // 代號所有類型均為必填
    if (!form.ticker.trim()) {
      setErrors({ ticker: '代號必填' })
      return
    }

    if (editItem) {
      await assetRepo.update(editItem.id, form)
    } else {
      // 檢查是否有相同代號的資產
      const tickerMatch = assets.find(a => a.ticker.trim() === form.ticker.trim())
      if (tickerMatch) {
        if (
          tickerMatch.assetType === form.assetType &&
          tickerMatch.market === form.market &&
          tickerMatch.currency === form.currency
        ) {
          // 代號、類型、市場、幣別完全一致 → 自動合併為新批次
          const newLotBuyDate = new Date().toISOString()
          const newLot: AssetLot = {
            id: uuidv4(),
            name: `${tickerMatch.name} ${formatLotDate(newLotBuyDate)}`,
            buyPrice: form.buyPrice,
            buyDate: newLotBuyDate,
            quantity: form.quantity,
          }
          let existingLots = tickerMatch.lots ?? []
          if (existingLots.length === 0) {
            // 原有資料尚未分批，將其轉為第一批
            const firstLot: AssetLot = {
              id: uuidv4(),
              name: tickerMatch.name,
              buyPrice: tickerMatch.buyPrice,
              buyDate: tickerMatch.createdAt,
              quantity: tickerMatch.quantity,
            }
            existingLots = [firstLot]
          }
          const allLots = [...existingLots, newLot]
          const { quantity, buyPrice, fxRateToBase } = calcLotsStats(allLots)
          await assetRepo.update(tickerMatch.id, { lots: allLots, quantity, buyPrice, fxRateToBase })
        } else {
          // 代號相同但類型／市場／幣別不符 → 提示錯誤
          setErrors({ ticker: `代號「${form.ticker}」已存在，但類型、市場或幣別不符，請確認` })
          return
        }
      } else {
        const fx = form.currency === 'TWD' ? 1
          : form.currency === 'USD' && exchangeRate?.usdRate ? exchangeRate.usdRate
          : form.currency === 'JPY' && exchangeRate?.jpyRate ? exchangeRate.jpyRate
          : form.currency === 'CNY' && exchangeRate?.cnyRate ? exchangeRate.cnyRate
          : undefined
        await assetRepo.add({ ...form, fxRateToBase: fx } as Parameters<typeof assetRepo.add>[0])
      }
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (deleteId) {
      await assetRepo.delete(deleteId)
      setDeleteId(null)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">資產管理</h3>
        <div className="flex gap-2">
          <button onClick={() => { setBulkResults([]); setBulkOpen(true) }} className="btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" />
            更新股價
          </button>
          <button onClick={openAdd} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            新增資產
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <SortTh label="名稱" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="代號" sortKey="ticker" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="類型" sortKey="assetType" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="市場" sortKey="market" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="買入平均價格" sortKey="buyPrice" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh label="現價" sortKey="currentPrice" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <th className="text-right">成本匯率</th>
              <SortTh label="數量" sortKey="quantity" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh label="未實現損益" sortKey="unrealizedPnl" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh label="幣別" sortKey="currency" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center text-gray-400 py-8">
                  尚無資產，請先新增
                </td>
              </tr>
            )}
            {sorted.map((a) => (
              <Fragment key={a.id}>
                <tr>
                  <td className="font-medium">
                    <div className="flex items-center gap-1">
                      {(a.lots && a.lots.length > 0) && (
                        <button
                          onClick={() => toggleExpand(a.id)}
                          className="p-0.5 rounded hover:bg-gray-100 text-gray-400 flex-shrink-0"
                          title={expandedIds.has(a.id) ? '收合' : '展開批次'}
                        >
                          {expandedIds.has(a.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <span>{a.name}</span>
                      {(a.lots && a.lots.length > 0) && (
                        <span className="text-xs text-blue-500 bg-blue-50 px-1.5 rounded">{a.lots.length} 批</span>
                      )}
                    </div>
                  </td>
                  <td className="font-mono">{a.ticker}</td>
                  <td>{ASSET_TYPE_LABELS[a.assetType]}</td>
                  <td>{MARKET_LABELS[a.market]}</td>
                  <td className="text-right font-mono">{a.buyPrice != null ? a.buyPrice.toLocaleString() : '-'}</td>
                  <td className="text-right font-mono">{a.currentPrice != null ? a.currentPrice.toLocaleString() : '-'}</td>
                  <td className="text-right font-mono text-gray-600">
                    {(() => {
                      if (a.currency === 'TWD') return '1'
                      if (a.fxRateToBase != null && a.fxRateToBase > 0) return a.fxRateToBase.toFixed(4)
                      // fallback: 目前匯率
                      if (a.currency === 'USD' && exchangeRate?.usdRate) return exchangeRate.usdRate.toFixed(4)
                      if (a.currency === 'JPY' && exchangeRate?.jpyRate) return exchangeRate.jpyRate.toFixed(4)
                      if (a.currency === 'CNY' && exchangeRate?.cnyRate) return exchangeRate.cnyRate.toFixed(4)
                      return '-'
                    })()}
                  </td>
                  <td className="text-right font-mono">{a.quantity != null ? a.quantity.toLocaleString() : '-'}</td>
                  <td className="text-right font-mono">
                    {(() => {
                      if (a.currentPrice == null || a.buyPrice == null || a.quantity == null) return <span className="text-gray-400">-</span>
                      const pnl = (a.currentPrice - a.buyPrice) * a.quantity
                      const cls = pnl > 0 ? 'text-red-500' : pnl < 0 ? 'text-green-600' : 'text-gray-400'
                      return <span className={cls}>{pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    })()}
                  </td>
                  <td>{a.currency}</td>
                  <td className="text-gray-400 text-sm">{a.note || '-'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openPriceUpdate(a)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="更新股價">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedIds.has(a.id) && (
                  <>
                    <tr className="bg-gray-50">
                      <td colSpan={10} className="pt-1 pb-0 px-0">
                        <div className="pl-10 pr-4 flex items-center gap-4 text-xs text-gray-400 border-b border-gray-200 pb-1">
                          <span className="w-4 shrink-0"></span>
                          <span className="w-52 shrink-0">名稱</span>
                          <span className="w-20 shrink-0">代號</span>
                          <span className="w-14 shrink-0">市場</span>
                          <span className="w-28 shrink-0 text-right">買入平均價格</span>
                          <span className="w-20 shrink-0 text-right">成本匯率</span>
                          <span className="w-36 shrink-0">買入日期</span>
                          <span className="w-20 shrink-0 text-right">數量</span>
                          <span className="w-16 shrink-0"></span>
                        </div>
                      </td>
                    </tr>
                    {(a.lots ?? []).map((lot, i) => (
                      <tr key={lot.id} className="bg-gray-50 hover:bg-gray-100/60">
                        <td colSpan={10} className="py-1 px-0">
                          <div className="pl-10 pr-4 flex items-center gap-4 text-sm">
                            <span className="text-gray-300 w-4 shrink-0 text-xs text-right tabular-nums">{i + 1}</span>
                            <span className="w-52 shrink-0 font-medium truncate" title={lot.name}>{lot.name}</span>
                            <span className="w-20 shrink-0 font-mono text-xs text-gray-500">{a.ticker}</span>
                            <span className="w-14 shrink-0 text-gray-600">{MARKET_LABELS[a.market]}</span>
                            <span className="w-28 shrink-0 text-right font-mono">{lot.buyPrice != null ? lot.buyPrice.toLocaleString() : '-'}</span>
                            <span className="w-20 shrink-0 text-right font-mono text-gray-600">
                              {(() => {
                                if (a.currency === 'TWD') return '1'
                                if (lot.fxRateToBase != null && lot.fxRateToBase > 0) return lot.fxRateToBase.toFixed(4)
                                // fallback: 目前匯率
                                if (a.currency === 'USD' && exchangeRate?.usdRate) return exchangeRate.usdRate.toFixed(4)
                                if (a.currency === 'JPY' && exchangeRate?.jpyRate) return exchangeRate.jpyRate.toFixed(4)
                                if (a.currency === 'CNY' && exchangeRate?.cnyRate) return exchangeRate.cnyRate.toFixed(4)
                                return '-'
                              })()}
                            </span>
                            <span className="w-36 shrink-0 text-gray-500">{formatLotDate(lot.buyDate)}</span>
                            <span className="w-20 shrink-0 text-right font-mono">{lot.quantity != null ? lot.quantity.toLocaleString() : '-'}</span>
                            <div className="w-16 shrink-0 flex gap-1">
                              <button onClick={() => openLotEdit(a, lot)} className="p-1 rounded hover:bg-gray-200 text-gray-500" title="編輯批次">
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => setLotDeleteTarget({ asset: a, lot })} className="p-1 rounded hover:bg-red-50 text-red-400" title="刪除批次">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? '編輯資產' : '新增資產'}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="form-group col-span-2">
            <label className="label">資產名稱 *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：台積電" />
            {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="label">代號 *</label>
            <input className="input" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder={form.assetType === 'fund' ? '例：0P0001EHG8.F' : '例：2330'} />
            {errors.ticker && <span className="text-xs text-red-500">{errors.ticker}</span>}
            {form.assetType === 'fund' && (
              <span className="text-xs text-gray-400 mt-0.5 block">
                Yahoo Finance 代碼，可至{' '}
                <a href="https://finance.yahoo.com/lookup/" target="_blank" rel="noreferrer" className="text-blue-500 underline">Yahoo Finance</a>{' '}
                搜尋基金名稱取得
              </span>
            )}
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as AssetInput['currency'] })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">資產類型</label>
            <select className="select" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value as AssetInput['assetType'] })}>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">市場</label>
            <select className="select" value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as AssetInput['market'] })}>
              {MARKETS.map((m) => <option key={m} value={m}>{MARKET_LABELS[m]}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="label">備註</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="選填" />
          </div>
          <div className="form-group">
            <label className="label">買入平均價格</label>
            <input className="input" type="number" min="0" step="any" value={form.buyPrice ?? 0} onChange={(e) => setForm({ ...form, buyPrice: e.target.value === '' ? 0 : Number(e.target.value) })} placeholder="選填" />
          </div>
          <div className="form-group">
            <label className="label">現價</label>
            <input className="input" type="number" min="0" step="any" value={form.currentPrice ?? ''} onChange={(e) => setForm({ ...form, currentPrice: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="選填" />
          </div>
          <div className="form-group">
            <label className="label">數量</label>
            <input className="input" type="number" min="0" step="any" value={form.quantity ?? ''} onChange={(e) => setForm({ ...form, quantity: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="選填" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">儲存</button>
        </div>
      </Modal>

      {/* Lot Edit Modal */}
      <Modal isOpen={!!lotEditTarget} onClose={() => setLotEditTarget(null)} title="編輯批次">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="form-group col-span-2">
            <label className="label">名稱</label>
            <input className="input" value={lotForm.name} onChange={(e) => setLotForm({ ...lotForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">買入平均價格</label>
            <input className="input" type="number" min="0" step="any" value={lotForm.buyPrice} onChange={(e) => setLotForm({ ...lotForm, buyPrice: e.target.value })} placeholder="選填" />
          </div>
          <div className="form-group">
            <label className="label">成本匯率</label>
            <input className="input" type="number" min="0" step="0.0001" value={lotForm.fxRateToBase} onChange={(e) => setLotForm({ ...lotForm, fxRateToBase: e.target.value })} placeholder={lotEditTarget?.asset.currency === 'TWD' ? '1' : '選填'} disabled={lotEditTarget?.asset.currency === 'TWD'} />
            <span className="text-xs text-gray-400">1 {lotEditTarget?.asset.currency ?? ''} = X TWD</span>
          </div>
          <div className="form-group">
            <label className="label">數量</label>
            <input className="input" type="number" min="0" step="any" value={lotForm.quantity} onChange={(e) => setLotForm({ ...lotForm, quantity: e.target.value })} placeholder="選填" />
          </div>
          <div className="form-group col-span-2">
            <label className="label">買入日期</label>
            <input className="input" type="datetime-local" value={lotForm.buyDate} onChange={(e) => setLotForm({ ...lotForm, buyDate: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setLotEditTarget(null)} className="btn-secondary">取消</button>
          <button onClick={handleLotSave} className="btn-primary">儲存</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!lotDeleteTarget}
        title="刪除批次"
        message={`確定要刪除「${lotDeleteTarget?.lot.name}」批次嗎？`}
        confirmLabel="刪除"
        onConfirm={handleLotDelete}
        onCancel={() => setLotDeleteTarget(null)}
        danger
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        title="刪除資產"
        message="確定要刪除此資產嗎？相關的交易紀錄不會被刪除。"
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />

      {/* Bulk Price Update Modal */}
      <Modal isOpen={bulkOpen} onClose={() => { if (!bulkRunning) setBulkOpen(false) }} title="更新所有股價">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">自動從 Yahoo Finance 取得所有資產的最新市價（CASH 類跟過）。</p>

          {bulkResults.length > 0 && (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {bulkResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium text-gray-700">{r.name} <span className="font-mono text-gray-400 text-xs">{r.ticker}</span></span>
                  {r.status === 'success' && <span className="text-green-600 font-mono">{r.price?.toLocaleString()}</span>}
                  {r.status === 'error' && <span className="text-red-500">取得失敗</span>}
                  {r.status === 'skip' && <span className="text-gray-400">跳過</span>}
                </div>
              ))}
            </div>
          )}

          {bulkRunning && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              更新中，請稍候…
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setBulkOpen(false)} disabled={bulkRunning} className="btn-secondary disabled:opacity-50">關閉</button>
            <button onClick={handleBulkUpdate} disabled={bulkRunning} className="btn-primary disabled:opacity-50 flex items-center gap-1.5">
              {bulkRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              開始更新
            </button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={!!priceAsset} onClose={() => setPriceAsset(null)} title="更新股價">
        {priceAsset && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
              <div className="font-semibold text-gray-800">{priceAsset.name}</div>
              <div className="text-gray-500 mt-0.5">{priceAsset.ticker} · {MARKET_LABELS[priceAsset.market]} · {priceAsset.currency}</div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={toGoogleFinanceUrl(priceAsset.ticker, priceAsset.market)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                在 Google Finance 查詢現價
              </a>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">現價（{priceAsset.currency}）</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="輸入現價"
                />
              </div>
              <div className="flex flex-col justify-end">
                <button
                  onClick={handleAutoFetch}
                  disabled={fetchStatus === 'loading' || priceAsset.market === 'CASH'}
                  className="btn-secondary btn-sm flex items-center gap-1.5 h-[38px] disabled:opacity-50"
                >
                  {fetchStatus === 'loading'
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                  自動取得
                </button>
              </div>
            </div>

            {fetchMsg && (
              <p className={`text-xs ${fetchStatus === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {fetchMsg}
              </p>
            )}

            {priceAsset.market === 'CASH' && (
              <p className="text-xs text-gray-400">現金類資產不需要更新股價</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPriceAsset(null)} className="btn-secondary">取消</button>
              <button
                onClick={handlePriceSave}
                disabled={priceInput === '' || isNaN(parseFloat(priceInput))}
                className="btn-primary disabled:opacity-50"
              >
                儲存
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
