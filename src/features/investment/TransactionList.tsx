import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { InvestmentTransaction, AssetLot } from '@/data/types'
import { investmentTxRepo, assetRepo, accountRepo } from '@/data/repositories'
import { v4 as uuidv4 } from 'uuid'
import { InvestmentTransactionSchema, InvestmentTransactionInput } from '@/data/schemas'
import {
  CURRENCIES,
  INVESTMENT_TX_TYPES,
  INVESTMENT_TX_TYPE_LABELS,
  ASSET_TYPE_LABELS,
  MARKET_LABELS,
} from '@/lib/constants'
import { formatDatetime, formatNumber, formatCurrency } from '@/lib/formatters'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SortTh } from '@/components/common/SortTh'
import { useSortable, sortByKey } from '@/lib/sorting'
import { Plus, Edit2, Trash2, Filter } from 'lucide-react'

const toDatetimeLocal = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const emptyForm = (): InvestmentTransactionInput => ({
  date: toDatetimeLocal(new Date()),
  assetId: '',
  accountId: '',
  txType: 'buy',
  quantity: 0,
  price: 0,
  currency: 'TWD',
  fxRateToBase: 1,
  fee: 0,
  tax: 0,
  note: '',
})

interface Filters {
  dateFrom: string
  dateTo: string
  currency: string
  market: string
  assetType: string
  accountId: string
  keyword: string
}

const emptyFilters = (): Filters => ({
  dateFrom: '',
  dateTo: '',
  currency: '',
  market: '',
  assetType: '',
  accountId: '',
  keyword: '',
})

const TX_TYPE_BADGE_CLASS: Record<string, string> = {
  buy: 'badge-buy',
  sell: 'badge-sell',
  dividend: 'badge-dividend',
  fee: 'badge-fee',
  tax: 'badge-tax',
  deposit: 'badge-deposit',
  withdrawal: 'badge-withdrawal',
}

function calcLotsStats(lots: AssetLot[]): { quantity: number | undefined; buyPrice: number } {
  const totalQty = lots.reduce((s, l) => s + (l.quantity ?? 0), 0)
  const withBoth = lots.filter(l => l.quantity != null && l.quantity > 0 && l.buyPrice != null)
  const weightedSum = withBoth.reduce((s, l) => s + l.buyPrice! * l.quantity!, 0)
  const qtyForWA = withBoth.reduce((s, l) => s + l.quantity!, 0)
  return {
    quantity: totalQty > 0 ? totalQty : undefined,
    buyPrice: qtyForWA > 0 ? weightedSum / qtyForWA : 0,
  }
}

function calcNetAmount(tx: InvestmentTransaction) {
  const gross = tx.quantity * tx.price
  if (tx.txType === 'buy' || tx.txType === 'deposit') {
    return -(gross + tx.fee + tx.tax)
  } else if (tx.txType === 'sell' || tx.txType === 'dividend' || tx.txType === 'withdrawal') {
    return gross - tx.fee - tx.tax
  }
  return -(tx.fee + tx.tax)
}

export interface TxFilters {
  dateFrom: string
  dateTo: string
  currency: string
  market: string
  assetType: string
  accountId: string
  keyword: string
}

export function TransactionList({ onFiltersChange }: { onFiltersChange?: (f: TxFilters) => void }) {
  const transactions = useLiveQuery(() => db.investmentTransactions.orderBy('date').reverse().toArray(), []) ?? []
  const assets = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<InvestmentTransaction | null>(null)
  const [form, setForm] = useState<InvestmentTransactionInput>(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters())
  const [showFilters, setShowFilters] = useState(false)

  // 篩選條件變動時通知父層（HoldingStats 同步用）
  useEffect(() => {
    onFiltersChange?.(filters)
  }, [filters, onFiltersChange])

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const { sortKey, sortDir, handleSort } = useSortable('date', 'desc')

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.dateFrom && tx.date.slice(0, 10) < filters.dateFrom) return false
      if (filters.dateTo && tx.date.slice(0, 10) > filters.dateTo) return false
      if (filters.currency && tx.currency !== filters.currency) return false
      if (filters.accountId && tx.accountId !== filters.accountId) return false
      const asset = assetMap.get(tx.assetId)
      if (filters.market && asset?.market !== filters.market) return false
      if (filters.assetType && asset?.assetType !== filters.assetType) return false
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase()
        const name = asset?.name.toLowerCase() ?? ''
        const ticker = asset?.ticker.toLowerCase() ?? ''
        const note = tx.note?.toLowerCase() ?? ''
        if (!name.includes(kw) && !ticker.includes(kw) && !note.includes(kw)) return false
      }
      return true
    })
  }, [transactions, filters, assetMap])

  const sorted = useMemo(() => sortByKey(filtered, sortKey, sortDir, (tx, key) => {
    switch (key) {
      case 'date': return tx.date
      case 'assetName': return assetMap.get(tx.assetId)?.name ?? ''
      case 'txType': return INVESTMENT_TX_TYPE_LABELS[tx.txType]
      case 'quantity': return tx.quantity
      case 'price': return tx.price
      case 'net': return calcNetAmount(tx)
      default: return ''
    }
  }), [filtered, sortKey, sortDir, assetMap])

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm())
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item: InvestmentTransaction) => {
    setEditItem(item)
    setForm({
      date: item.date.length === 10 ? `${item.date}T00:00:00` : item.date.slice(0, 19),
      assetId: item.assetId,
      accountId: item.accountId,
      txType: item.txType,
      quantity: item.quantity,
      price: item.price,
      currency: item.currency,
      fxRateToBase: item.fxRateToBase,
      fee: item.fee,
      tax: item.tax,
      note: item.note ?? '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleCurrencyChange = (currency: InvestmentTransactionInput['currency']) => {
    const currentAccount = accounts.find(a => a.id === form.accountId)
    setForm((prev) => ({
      ...prev,
      currency,
      fxRateToBase: currency === 'TWD' ? 1 : prev.fxRateToBase,
      accountId: currentAccount?.currency === currency ? prev.accountId : '',
    }))
  }

  const handleSave = async () => {
    const result = InvestmentTransactionSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[String(e.path[0])] = e.message })
      setErrors(errs)
      return
    }
    if ((form.txType === 'buy' || form.txType === 'sell') && (form.quantity ?? 0) <= 0) {
      setErrors({ quantity: '買入／賣出數量不得為 0' })
      return
    }
    if (editItem) {
      await investmentTxRepo.update(editItem.id, form)
    } else {
      // 該幣別無對應帳戶時阻止新增
      const matchedAccounts = accounts.filter(a => a.currency === form.currency)
      if (matchedAccounts.length === 0) {
        setErrors({ accountId: `請先在帳戶管理新增 ${form.currency} 帳戶` })
        return
      }
      await investmentTxRepo.add(form)
      // 買入/賣出：同步更新帳戶餘額
      if (form.accountId && (form.txType === 'buy' || form.txType === 'sell')) {
        const account = accounts.find(a => a.id === form.accountId)
        if (account) {
          // 將交易金額（含手續費、稅費）換算為帳戶幣別
          // fxRateToBase = 1 TWD = X 交易幣別 → 交易幣別 to 帳戶幣別需透過 TWD 橋接
          // 若帳戶幣別 = 交易幣別，直接使用；否則透過 fxRateToBase 換算
          let delta = 0
          const gross = form.quantity * form.price
          const feeTax = form.fee + form.tax
          if (account.currency === form.currency) {
            // 同幣別：直接加減
            delta = form.txType === 'buy' ? -(gross + feeTax) : (gross - feeTax)
          } else if (account.currency === 'TWD') {
            // 帳戶為 TWD：透過 fxRateToBase 換算（fxRateToBase = 1 TWD 兌 X 外幣，即外幣/TWD）
            // 所以 1 外幣 = 1/fxRateToBase TWD
            const rate = form.fxRateToBase > 0 ? 1 / form.fxRateToBase : 1
            delta = form.txType === 'buy' ? -(gross + feeTax) * rate : (gross - feeTax) * rate
          } else {
            // 其他幣別組合：以 TWD 換算後再換回帳戶幣別（暫不處理，不更新）
            delta = 0
          }
          if (delta !== 0) {
            await accountRepo.update(account.id, { balance: (account.balance ?? 0) + delta })
          }
        }
      }
      // 買入：自動在資產管理新增批次；賣出：FIFO 扣除批次
      if (form.assetId && (form.txType === 'buy' || form.txType === 'sell')) {
        const asset = assets.find(a => a.id === form.assetId)
        if (asset) {
          if (form.txType === 'buy') {
            const now = new Date()
            const buyDate = form.date
              ? new Date(form.date).toISOString()
              : now.toISOString()
            const bd = new Date(buyDate)
            const p = (n: number) => String(n).padStart(2, '0')
            const buyDateLabel = `${bd.getFullYear()}-${p(bd.getMonth()+1)}-${p(bd.getDate())} ${p(bd.getHours())}:${p(bd.getMinutes())}`
            const newLot: AssetLot = {
              id: uuidv4(),
              name: `${asset.name} ${buyDateLabel}`,
              buyPrice: form.price,
              buyDate,
              quantity: form.quantity,
            }
            let existingLots = asset.lots ?? []
            if (existingLots.length === 0 && (asset.quantity != null || (asset.buyPrice ?? 0) > 0)) {
              // 將原有直接欄位轉為第一批
              const firstLot: AssetLot = {
                id: uuidv4(),
                name: asset.name,
                buyPrice: asset.buyPrice ?? 0,
                buyDate: asset.createdAt,
                quantity: asset.quantity,
              }
              existingLots = [firstLot]
            }
            const allLots = [...existingLots, newLot]
            const { quantity, buyPrice } = calcLotsStats(allLots)
            await assetRepo.update(asset.id, { lots: allLots, quantity, buyPrice })
          } else {
            // 賣出：FIFO，從最舊批次開始扣除
            let existingLotsForSell = asset.lots ?? []
            // 若無批次但有直接欄位數量，先轉為合成批次
            if (existingLotsForSell.length === 0 && (asset.quantity ?? 0) > 0) {
              existingLotsForSell = [{
                id: uuidv4(),
                name: asset.name,
                buyPrice: asset.buyPrice ?? 0,
                buyDate: asset.createdAt,
                quantity: asset.quantity,
              }]
            }
            const sortedLots = [...existingLotsForSell].sort((a, b) => a.buyDate.localeCompare(b.buyDate))
            let remaining = form.quantity
            const updatedLots: AssetLot[] = []
            for (const lot of sortedLots) {
              const lotQty = lot.quantity ?? 0
              if (remaining <= 0) {
                updatedLots.push(lot)
              } else if (lotQty <= remaining) {
                remaining -= lotQty
              } else {
                updatedLots.push({ ...lot, quantity: lotQty - remaining })
                remaining = 0
              }
            }
            const { quantity, buyPrice } = calcLotsStats(updatedLots)
            await assetRepo.update(asset.id, { lots: updatedLots, quantity, buyPrice })
          }
        }
      }
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (deleteId) {
      await investmentTxRepo.delete(deleteId)
      setDeleteId(null)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">投資交易紀錄</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary btn-sm ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : ''}`}
          >
            <Filter className="w-4 h-4" />
            篩選
          </button>
          <button onClick={openAdd} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            新增交易
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card mb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="form-group">
            <label className="label">日期起</label>
            <input type="date" className="input" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">日期迄</label>
            <input type="date" className="input" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={filters.currency} onChange={(e) => setFilters({ ...filters, currency: e.target.value })}>
              <option value="">全部</option>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">帳戶</label>
            <select className="select" value={filters.accountId} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}>
              <option value="">全部</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">市場</label>
            <select className="select" value={filters.market} onChange={(e) => setFilters({ ...filters, market: e.target.value })}>
              <option value="">全部</option>
              {Object.entries(MARKET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">資產類型</label>
            <select className="select" value={filters.assetType} onChange={(e) => setFilters({ ...filters, assetType: e.target.value })}>
              <option value="">全部</option>
              {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="label">關鍵字</label>
            <input className="input" placeholder="名稱、代號、備註" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters(emptyFilters())} className="btn-secondary btn-sm">清除篩選</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <SortTh label="日期" sortKey="date" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="標的" sortKey="assetName" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th>市場/類型</th>
              <SortTh label="交易類型" sortKey="txType" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="數量" sortKey="quantity" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh label="單價" sortKey="price" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <th>幣別</th>
              <th>手續費</th>
              <th>稅費</th>
              <SortTh label="淨額" sortKey="net" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <th>帳戶</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center text-gray-400 py-8">無交易紀錄</td>
              </tr>
            )}
            {sorted.map((tx) => {
              const asset = assetMap.get(tx.assetId)
              const account = accountMap.get(tx.accountId)
              const net = calcNetAmount(tx)
              return (
                <tr key={tx.id}>
                  <td className="whitespace-nowrap">{formatDatetime(tx.date)}</td>
                  <td>
                    <div className="font-medium text-gray-900">{asset?.name ?? '-'}</div>
                    <div className="text-xs text-gray-400 font-mono">{asset?.ticker ?? '-'}</div>
                  </td>
                  <td>
                    <div className="text-xs">{MARKET_LABELS[asset?.market ?? 'TW'] ?? '-'}</div>
                    <div className="text-xs text-gray-400">{ASSET_TYPE_LABELS[asset?.assetType ?? 'tw_stock'] ?? '-'}</div>
                  </td>
                  <td>
                    <span className={TX_TYPE_BADGE_CLASS[tx.txType] ?? 'badge'}>
                      {INVESTMENT_TX_TYPE_LABELS[tx.txType]}
                    </span>
                  </td>
                  <td className="text-right font-mono">{formatNumber(tx.quantity, tx.quantity % 1 === 0 ? 0 : 4)}</td>
                  <td className="text-right font-mono">{formatNumber(tx.price, 2)}</td>
                  <td>{tx.currency}</td>
                  <td className="text-right text-sm text-gray-500">{formatNumber(tx.fee, 2)}</td>
                  <td className="text-right text-sm text-gray-500">{formatNumber(tx.tax, 2)}</td>
                  <td className={`text-right font-mono font-medium ${net > 0 ? '!text-red-500' : net < 0 ? '!text-green-600' : ''}`}>
                    {formatNumber(net, 2)}
                  </td>
                  <td className="text-sm">{account?.name ?? '-'}</td>
                  <td className="text-xs text-gray-400">{tx.note || '-'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(tx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(tx.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? '編輯交易' : '新增交易'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">日期 *</label>
            <input type="datetime-local" step="1" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">交易類型 *</label>
            <select className="select" value={form.txType} onChange={(e) => setForm({ ...form, txType: e.target.value as InvestmentTransactionInput['txType'] })}>
              {INVESTMENT_TX_TYPES.map((t) => <option key={t} value={t}>{INVESTMENT_TX_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">資產 *</label>
            <select className="select" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
              <option value="">請選擇</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ticker})</option>)}
            </select>
            {errors.assetId && <span className="text-xs text-red-500">{errors.assetId}</span>}
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={form.currency} onChange={(e) => handleCurrencyChange(e.target.value as InvestmentTransactionInput['currency'])}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">帳戶 *</label>
            {(() => {
              const matchedAccounts = accounts.filter(a => a.currency === form.currency)
              return (
                <>
                  <select
                    className="select"
                    value={form.accountId}
                    onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                    disabled={matchedAccounts.length === 0}
                  >
                    <option value="">{matchedAccounts.length === 0 ? `無 ${form.currency} 帳戶` : '請選擇'}</option>
                    {matchedAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {matchedAccounts.length === 0 && (
                    <span className="text-xs text-red-500">請先在帳戶管理新增 {form.currency} 帳戶才能建立交易</span>
                  )}
                  {form.accountId && (() => {
                    const selAcc = matchedAccounts.find(a => a.id === form.accountId)
                    if (!selAcc) return null
                    const bal = selAcc.balance ?? 0
                    return (
                      <span className={`text-xs ${bal < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        現有資金：{formatCurrency(bal, selAcc.currency)}
                      </span>
                    )
                  })()}
                  {errors.accountId && <span className="text-xs text-red-500">{errors.accountId}</span>}
                </>
              )
            })()}
          </div>
          <div className="form-group">
            <label className="label">匯率 (對 TWD)</label>
            <input type="number" min="0.0001" step="0.01" className="input" value={form.fxRateToBase} onChange={(e) => setForm({ ...form, fxRateToBase: Number(e.target.value) })} disabled={form.currency === 'TWD'} />
          </div>
          <div className="form-group">
            <label className="label">數量</label>
            <input type="number" min="0" step="1" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            {errors.quantity && <span className="text-xs text-red-500">{errors.quantity}</span>}
          </div>
          <div className="form-group">
            <label className="label">單價</label>
            <div className="flex gap-2 items-center">
              <input type="number" min="0" step="0.01" className="input flex-1" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              {(() => {
                const selAsset = form.assetId ? assets.find(a => a.id === form.assetId) : undefined
                if (!selAsset || !selAsset.currentPrice) return null
                return (
                  <button
                    type="button"
                    className="btn-secondary btn-sm whitespace-nowrap"
                    onClick={() => setForm(prev => ({ ...prev, price: selAsset.currentPrice! }))}
                    title={`使用現價 ${selAsset.currentPrice}`}
                  >
                    現價 {selAsset.currentPrice}
                  </button>
                )
              })()}
            </div>
          </div>
          <div className="form-group">
            <label className="label">手續費</label>
            <input type="number" min="0" step="0.01" className="input" value={form.fee} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">稅費</label>
            <input type="number" min="0" step="0.01" className="input" value={form.tax} onChange={(e) => setForm({ ...form, tax: Number(e.target.value) })} />
          </div>
          <div className="form-group col-span-2">
            <label className="label">備註</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {(() => {
              const topNotes = [...transactions
                .map(tx => tx.note?.trim())
                .filter((n): n is string => !!n)
                .reduce((map, n) => { map.set(n, (map.get(n) ?? 0) + 1); return map }, new Map<string, number>())
                .entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([n]) => n)
              if (topNotes.length === 0) return null
              return (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {topNotes.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, note: n }))}
                      className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-gray-600 transition-colors"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">儲存</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="刪除交易"
        message="確定要刪除此交易紀錄嗎？"
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  )
}
