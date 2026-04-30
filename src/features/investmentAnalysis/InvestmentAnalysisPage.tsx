import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart2, AlertTriangle, Filter, RefreshCw, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import { db } from '@/data/db'
import { assetRepo } from '@/data/repositories'
import { fetchPrice, BulkPriceResult } from '@/data/services/priceService'
import {
  getTotalInvestmentMarketValueTWD,
  calculateAssetAnalysisRows,
  calculateFundAnalysisRows,
  calculateInvestmentAnalysisSummary,
} from '@/data/services/investmentAnalysis'
import { InvestmentAnalysisSummaryCards } from './components/InvestmentAnalysisSummaryCards'
import { AssetAnalysisTable } from './components/AssetAnalysisTable'
import { FundAnalysisTable } from './components/FundAnalysisTable'
import { InvestmentWarningsPanel } from './components/InvestmentWarningsPanel'
import { AnalysisFilters, DEFAULT_FILTERS, AnalysisFilterState } from './components/AnalysisFilters'

type Section = 'general' | 'fund' | 'warnings'

export function InvestmentAnalysisPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<AnalysisFilterState>(DEFAULT_FILTERS)
  const [activeSection, setActiveSection] = useState<Section>('general')
  const [priceUpdating, setPriceUpdating] = useState(false)
  const [priceResults, setPriceResults] = useState<BulkPriceResult[] | null>(null)

  // ── 資料 ──
  const assets       = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const exchangeRate = useLiveQuery(() => db.exchangeRates.get('current'), [])
  const cashRecords  = useLiveQuery(() => db.incomeExpenseRecords.toArray(), []) ?? []
  const categories   = useLiveQuery(() => db.categories.toArray(), []) ?? []

  // ── 批次更新股價 ──
  const handleUpdatePrices = async () => {
    const targets = assets.filter(a =>
      a.assetType === 'fund' ? !!a.ticker.trim() : (a.market !== 'CASH' && a.market !== 'OTHER')
    )
    setPriceResults([])
    setPriceUpdating(true)
    const results: BulkPriceResult[] = []
    for (const a of targets) {
      try {
        const price = await fetchPrice(a.ticker, a.market, a.assetType)
        await assetRepo.update(a.id, { currentPrice: price })
        results.push({ assetId: a.id, name: a.name, ticker: a.ticker, status: 'success', price })
      } catch (e) {
        results.push({
          assetId: a.id, name: a.name, ticker: a.ticker, status: 'error',
          message: e instanceof Error ? e.message : '未知錯誤',
        })
      }
      setPriceResults([...results])
    }
    const targetIds = new Set(targets.map(a => a.id))
    assets.filter(a => !targetIds.has(a.id)).forEach(a => {
      results.push({ assetId: a.id, name: a.name, ticker: a.ticker, status: 'skip' })
    })
    setPriceResults([...results])
    setPriceUpdating(false)
  }

  // ── 配息 Map（基金利息收支紀錄 -> ticker 對應加總） ──
  // getFxForRecord：優先使用紀錄的 fxRateToBase，若為 0/無效則以當前匯率補足
  const getFxForRecord = (currency: string, fxRateToBase: number): number => {
    if (currency === 'TWD') return 1
    if (fxRateToBase && fxRateToBase > 0) return fxRateToBase
    if (!exchangeRate) return 1
    if (currency === 'USD' && exchangeRate.usdRate > 0) return exchangeRate.usdRate
    if (currency === 'JPY' && exchangeRate.jpyRate > 0) return exchangeRate.jpyRate
    if (currency === 'CNY' && exchangeRate.cnyRate > 0) return exchangeRate.cnyRate
    return 1
  }

  const distributionsByTicker = useMemo(() => {
    const fundInterestCatIds = new Set(
      categories.filter(c => c.name === '基金利息').map(c => c.id)
    )
    const map = new Map<string, number>()
    cashRecords.forEach(r => {
      if (!fundInterestCatIds.has(r.categoryId) || !r.linkedTicker) return
      map.set(r.linkedTicker, (map.get(r.linkedTicker) ?? 0) + r.amount)  // 原幣，不乘匯率
    })
    return map
  }, [cashRecords, categories])

  const dividendsByTicker = useMemo(() => {
    const dividendCatIds = new Set(
      categories.filter(c => c.name === '股利').map(c => c.id)
    )
    const map = new Map<string, number>()
    cashRecords.forEach(r => {
      if (!dividendCatIds.has(r.categoryId) || !r.linkedTicker) return
      const fx = getFxForRecord(r.currency, r.fxRateToBase)
      const amtTWD = r.amount * fx
      map.set(r.linkedTicker, (map.get(r.linkedTicker) ?? 0) + amtTWD)
    })
    return map
  }, [cashRecords, categories, exchangeRate])

  const trailing12ByTicker = useMemo(() => {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const fundInterestCatIds = new Set(
      categories.filter(c => c.name === '基金利息').map(c => c.id)
    )
    const map = new Map<string, number>()
    cashRecords.forEach(r => {
      if (!fundInterestCatIds.has(r.categoryId) || !r.linkedTicker) return
      if (r.date < cutoffStr) return
      map.set(r.linkedTicker, (map.get(r.linkedTicker) ?? 0) + r.amount)  // 原幣，不乘匯率
    })
    return map
  }, [cashRecords, categories])

  // ── 計算 ──
  const totalMV = useMemo(
    () => getTotalInvestmentMarketValueTWD(assets, exchangeRate),
    [assets, exchangeRate]
  )

  const allAssetRows = useMemo(
    () => calculateAssetAnalysisRows(assets, exchangeRate, totalMV, dividendsByTicker),
    [assets, exchangeRate, totalMV, dividendsByTicker]
  )

  const allFundRows = useMemo(
    () => calculateFundAnalysisRows(assets, exchangeRate, totalMV, distributionsByTicker, trailing12ByTicker),
    [assets, exchangeRate, totalMV, distributionsByTicker, trailing12ByTicker]
  )

  const summary = useMemo(
    () => calculateInvestmentAnalysisSummary(allAssetRows, allFundRows),
    [allAssetRows, allFundRows]
  )

  // ── 篩選 ──
  const assetRows = useMemo(() => allAssetRows.filter(r => {
    if (!filters.assetTypes.includes(r.assetType)) return false
    if (!filters.currencies.includes(r.currency))  return false
    if (!filters.markets.includes(r.market))        return false
    if (filters.onlyHolding && r.quantity <= 0)     return false
    return true
  }), [allAssetRows, filters])

  const fundRows = useMemo(() => allFundRows.filter(r => {
    if (!filters.currencies.includes(r.currency)) return false
    if (filters.onlyHolding && r.quantity <= 0)   return false
    return true
  }), [allFundRows, filters])

  const totalWarnings = [...assetRows, ...fundRows].reduce((s, r) => s + r.warnings.length, 0)
  const dangerCount   = [...assetRows, ...fundRows].reduce((s, r) => s + r.warnings.filter(w => w.level === 'danger').length, 0)

  // ── 頁籤 ──
  const sections: { id: Section; label: string; badge?: number; danger?: boolean }[] = [
    { id: 'general',   label: `一般標的 (${assetRows.filter(r => r.quantity > 0).length})` },
    { id: 'fund',      label: `基金 (${fundRows.filter(r => r.quantity > 0).length})` },
    { id: 'warnings',  label: '風險警示', badge: totalWarnings, danger: dangerCount > 0 },
  ]

  return (
    <div className="-mx-6 -mt-6 p-6 space-y-6">
      {/* 標題列 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-500" />
            投資績效分析
          </h1>
          <p className="text-sm text-slate-500 mt-1">績效診斷、報酬拆解與風險提示</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleUpdatePrices}
            disabled={priceUpdating}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${priceUpdating ? 'animate-spin' : ''}`} />
            {priceUpdating ? '更新中…' : '更新股價'}
          </button>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
          >
            <Filter className="w-4 h-4" />
            篩選
          </button>
        </div>
      </div>

      {/* 篩選面板 */}
      {showFilters && (
        <AnalysisFilters filters={filters} onChange={setFilters} />
      )}

      {/* 更新股價結果 */}
      {priceResults !== null && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              更新結果（
              <span className="text-emerald-600">{priceResults.filter(r => r.status === 'success').length} 成功</span>
              {priceResults.filter(r => r.status === 'error').length > 0 && (
                <span>、<span className="text-red-600">{priceResults.filter(r => r.status === 'error').length} 失敗</span></span>
              )}
              {priceResults.filter(r => r.status === 'skip').length > 0 && (
                <span>、<span className="text-slate-400">{priceResults.filter(r => r.status === 'skip').length} 略過</span></span>
              )}
              ）
            </p>
            {!priceUpdating && (
              <button onClick={() => setPriceResults(null)} className="text-xs text-slate-400 hover:text-slate-600">關閉</button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {priceResults.filter(r => r.status !== 'skip').map(r => (
              <div key={r.assetId} className="flex items-center gap-2 py-1.5 text-xs">
                {r.status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {r.status === 'error'   && <XCircle    className="w-3.5 h-3.5 text-red-500    shrink-0" />}
                {r.status === 'skip'    && <MinusCircle className="w-3.5 h-3.5 text-slate-300   shrink-0" />}
                <span className="text-slate-600 min-w-[6rem] truncate">{r.name}</span>
                <span className="text-slate-400 font-mono">{r.ticker}</span>
                {r.status === 'success' && <span className="ml-auto font-mono text-slate-700">{r.price}</span>}
                {r.status === 'error'   && <span className="ml-auto text-red-500 truncate max-w-[16rem]">{r.message}</span>}
              </div>
            ))}
            {priceUpdating && (
              <div className="py-2 text-xs text-slate-400 text-center">取得中，請稍候…</div>
            )}
          </div>
        </div>
      )}

      {/* KPI */}
      <InvestmentAnalysisSummaryCards summary={summary} />

      {/* 頁籤切換 */}
      <div className="flex gap-1.5 flex-wrap border-b border-slate-200 pb-0">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeSection === s.id
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {s.label}
            {s.badge != null && s.badge > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.danger ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 內容區 */}
      <section className="card p-4 md:p-6">
        {activeSection === 'general' && (
          <>
            <h2 className="text-base font-semibold text-slate-700 mb-3">一般標的分析表</h2>
            <p className="text-xs text-slate-400 mb-4">台股、美股、日股、ETF 等非基金資產。顏色慣例：正數紅色、負數綠色。</p>
            <AssetAnalysisTable rows={assetRows} />
          </>
        )}

        {activeSection === 'fund' && (
          <>
            <h2 className="text-base font-semibold text-slate-700 mb-3">基金分析表</h2>
            <p className="text-xs text-slate-400 mb-4">含息總報酬（粗體）為核心評估指標。近 12 月配息率與成本殖利率反映現金流效率。</p>
            <FundAnalysisTable rows={fundRows} />
          </>
        )}

        {activeSection === 'warnings' && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-semibold text-slate-700">風險警示</h2>
              {dangerCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  {dangerCount} 項危險
                </span>
              )}
            </div>
            <InvestmentWarningsPanel assetRows={assetRows} fundRows={fundRows} />
          </>
        )}
      </section>

      {/* 底部說明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
        <p><strong>計算說明：</strong>已實現價差僅計入賣出/提領交易；配息（dividend）獨立計算，不重複加入價差。成本採加權平均法。</p>
        <p>平均成本以原幣顯示（依資產加權平均匯率換算）。所有金額統一換算 TWD。</p>
        <p className="text-blue-500">⚠ 本工具僅供績效參考，不構成投資建議。匯率採當前設定值。</p>
      </div>
    </div>
  )
}
