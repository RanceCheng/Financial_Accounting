import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { RebalanceTarget } from '@/data/types'
import { rebalanceTargetRepo, exchangeRateRepo } from '@/data/repositories'
import { RebalanceTargetInput, RebalanceTargetSchema } from '@/data/schemas'
import {
  calcAllocationByAssetType,
  calcAllocationByCurrency,
  calcAllocationByAssetTypeMarketValue,
  calcAllocationByCurrencyMarketValue,
} from '@/data/services'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { ImportExportButtons } from '@/components/common/ImportExportButtons'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SortTh } from '@/components/common/SortTh'
import { useSortable, sortByKey } from '@/lib/sorting'
import { ASSET_TYPES, CURRENCIES, ASSET_TYPE_LABELS, CURRENCY_LABELS } from '@/lib/constants'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Plus, Edit2, Trash2, Target, AlertCircle, CheckCircle2, RefreshCw, Wifi, WifiOff, X } from 'lucide-react'

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const EXCHANGE_API_URL = 'https://open.er-api.com/v6/latest/TWD'

const emptyTargetForm = (): RebalanceTargetInput => ({
  label: '',
  targetKey: 'tw_stock',
  targetType: 'assetType',
  targetPercent: 0.25,
  tolerancePercent: 0.05,
})

export function RebalancePage() {
  const transactions = useLiveQuery(() => db.investmentTransactions.toArray(), []) ?? []
  const assets = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const rebalanceTargets = useLiveQuery(() => db.rebalanceTargets.toArray(), []) ?? []
  const exchangeRate = useLiveQuery(() => db.exchangeRates.get('current'), [])

  const [allocView, setAllocView] = useState<'assetType' | 'currency'>('assetType')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<RebalanceTarget | null>(null)
  const [form, setForm] = useState<RebalanceTargetInput>(emptyTargetForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [erLoading, setErLoading] = useState(false)
  const [erError, setErError] = useState<string | null>(null)
  const [selectedCostKey, setSelectedCostKey] = useState<string | null>(null)
  const [selectedMvKey, setSelectedMvKey] = useState<string | null>(null)
  const [tableView, setTableView] = useState<'cost' | 'mv'>('mv')

  const { sortKey, sortDir, handleSort } = useSortable('label')

  const sortedTargets = useMemo(() => sortByKey(rebalanceTargets, sortKey, sortDir, (t, key) => {
    switch (key) {
      case 'label': return t.label
      case 'targetType': return t.targetType === 'assetType' ? '資產類型' : '幣別'
      case 'targetPercent': return t.targetPercent
      case 'tolerancePercent': return t.tolerancePercent
      default: return ''
    }
  }), [rebalanceTargets, sortKey, sortDir])

  const costByType = useMemo(() => calcAllocationByAssetType(transactions, assets, rebalanceTargets, exchangeRate), [transactions, assets, rebalanceTargets, exchangeRate])
  const costByCurrency = useMemo(() => calcAllocationByCurrency(transactions, assets, rebalanceTargets, exchangeRate), [transactions, assets, rebalanceTargets, exchangeRate])
  const mvByType = useMemo(() => calcAllocationByAssetTypeMarketValue(assets, exchangeRate, rebalanceTargets, accounts), [assets, exchangeRate, rebalanceTargets, accounts])
  const mvByCurrency = useMemo(() => calcAllocationByCurrencyMarketValue(assets, exchangeRate, rebalanceTargets, accounts), [assets, exchangeRate, rebalanceTargets, accounts])

  const costAllocation = allocView === 'assetType' ? costByType : costByCurrency
  const mvAllocation = allocView === 'assetType' ? mvByType : mvByCurrency

  // 摘要卡片總額不隨視圖切換，常更以資產類型視圖為準
  const totalCostTWD = costByType.reduce((s, a) => s + a.currentAmountTWD, 0)
  const totalMvTWD = mvByType.reduce((s, a) => s + a.currentAmountTWD, 0)

  const sortedCostAllocation = [...costAllocation].sort((a, b) => b.currentPercent - a.currentPercent)
  const sortedMvAllocation = [...mvAllocation].sort((a, b) => b.currentPercent - a.currentPercent)
  const costChartData = sortedCostAllocation.map((a) => ({ name: a.label, value: a.currentAmountTWD }))
  const mvChartData = sortedMvAllocation.map((a) => ({ name: a.label, value: a.currentAmountTWD }))

  const costDetailRows = useMemo(() => {
    if (!selectedCostKey) return []
    return (allocView === 'assetType'
      ? assets.filter(a => a.assetType === selectedCostKey && (a.quantity ?? 0) > 0)
      : assets.filter(a => a.currency === selectedCostKey && (a.quantity ?? 0) > 0))
  }, [selectedCostKey, allocView, assets])

  const mvDetailAssets = useMemo(() => {
    if (!selectedMvKey) return []
    return (allocView === 'assetType'
      ? assets.filter(a => a.assetType === selectedMvKey && (a.quantity ?? 0) > 0 && (a.currentPrice ?? 0) > 0)
      : assets.filter(a => a.currency === selectedMvKey && (a.quantity ?? 0) > 0 && (a.currentPrice ?? 0) > 0))
  }, [selectedMvKey, allocView, assets])

  const costDetailLabel = selectedCostKey ? (costAllocation.find(a => a.key === selectedCostKey)?.label ?? selectedCostKey) : ''
  const mvDetailLabel = selectedMvKey ? (mvAllocation.find(a => a.key === selectedMvKey)?.label ?? selectedMvKey) : ''
  const isMvCashBucket = allocView === 'assetType' && selectedMvKey === 'cash'
  // 依資產類型選 cash → 顯示所有帳戶；依幣別 → 顯示對應幣別帳戶
  const mvShowAccounts = isMvCashBucket || allocView === 'currency'
  const accountsToShow = (isMvCashBucket
    ? accounts
    : accounts.filter(acc => acc.currency === selectedMvKey)
  ).slice().sort((a, b) => {
    const currencyCmp = a.currency.localeCompare(b.currency)
    if (currencyCmp !== 0) return currencyCmp
    return (b.balance ?? 0) - (a.balance ?? 0)
  })

  // 目標配置表格：依 target 的 targetType 從對應 allocation 查出實際比例
  const getActualPercent = (t: RebalanceTarget): number => {
    const source = t.targetType === 'assetType'
      ? (tableView === 'cost' ? costByType : mvByType)
      : (tableView === 'cost' ? costByCurrency : mvByCurrency)
    return source.find(a => a.key === t.targetKey)?.currentPercent ?? 0
  }

  const handleErRefresh = async () => {
    setErLoading(true)
    setErError(null)
    try {
      const res = await fetch(EXCHANGE_API_URL, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.result !== 'success') throw new Error('API 回傳失敗')
      await exchangeRateRepo.save({
        updatedAt: new Date().toISOString(),
        usdRate: data.rates?.USD ? parseFloat((1 / data.rates.USD).toFixed(4)) : 0,
        jpyRate: data.rates?.JPY ? parseFloat((1 / data.rates.JPY).toFixed(4)) : 0,
        cnyRate: data.rates?.CNY ? parseFloat((1 / data.rates.CNY).toFixed(4)) : 0,
      })
    } catch (e) {
      setErError(e instanceof Error ? e.message : '網路連線失敗，請稍後再試')
    } finally {
      setErLoading(false)
    }
  }

  const openAdd = () => { setEditItem(null); setForm(emptyTargetForm()); setErrors({}); setModalOpen(true) }
  const openEdit = (item: RebalanceTarget) => {
    setEditItem(item)
    setForm({ label: item.label, targetKey: item.targetKey, targetType: item.targetType, targetPercent: item.targetPercent, tolerancePercent: item.tolerancePercent })
    setErrors({})
    setModalOpen(true)
  }
  const handleSave = async () => {
    const result = RebalanceTargetSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[String(e.path[0])] = e.message })
      setErrors(errs)
      return
    }
    if (editItem) { await rebalanceTargetRepo.update(editItem.id, form) }
    else { await rebalanceTargetRepo.add(form) }
    setModalOpen(false)
  }
  const handleDelete = async () => {
    if (deleteId) { await rebalanceTargetRepo.delete(deleteId); setDeleteId(null) }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">資產再平衡表</h1>
          <p className="text-gray-500 text-sm mt-1">資產配置分析與再平衡建議</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAdd} className="btn-primary btn-sm"><Plus className="w-4 h-4" />設定目標</button>
          <ImportExportButtons />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-gray-700">成本（TWD）</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">{formatCurrency(totalCostTWD, 'TWD')}</div>
          <p className="text-xs text-gray-400 mt-1">以買入交易成本加總換算 TWD</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold text-gray-700">總資產（TWD）</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600">{formatCurrency(totalMvTWD, 'TWD')}</div>
          <p className="text-xs text-gray-400 mt-1">以各資產現價 × 數量 + 帳戶現金（全部換算 TWD）</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span>匯率參考</span>
            {exchangeRate ? <WifiOff className="w-4 h-4 text-gray-400" /> : <WifiOff className="w-4 h-4 text-gray-300" />}
          </h3>
          <button onClick={handleErRefresh} disabled={erLoading} className="btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${erLoading ? 'animate-spin' : ''}`} />
            {erLoading ? '更新中...' : '更新即時匯率'}
          </button>
        </div>
        {erError && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-center gap-2">
            <Wifi className="w-4 h-4 shrink-0" />{erError}
          </div>
        )}
        {exchangeRate ? (
          <div className="table-container">
            <table className="table border border-gray-200 border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 border-r border-gray-200">更新日期</th>
                  <th className="text-right px-4 py-3 border-r border-gray-200">USD 兌換 TWD</th>
                  <th className="text-right px-4 py-3 border-r border-gray-200">JPY 兌換 TWD</th>
                  <th className="text-right px-4 py-3">CNY 兌換 TWD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-600">
                    {new Date(exchangeRate.updatedAt).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 border-r border-gray-200 text-right font-mono">{exchangeRate.usdRate > 0 ? exchangeRate.usdRate.toFixed(4) : '-'}</td>
                  <td className="px-4 py-3 border-r border-gray-200 text-right font-mono">{exchangeRate.jpyRate > 0 ? exchangeRate.jpyRate.toFixed(4) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{exchangeRate.cnyRate > 0 ? exchangeRate.cnyRate.toFixed(4) : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">尚未載入匯率，請點擊「更新即時匯率」</p>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">配置分析</h3>
          <div className="flex gap-2">
            <button onClick={() => { setAllocView('assetType'); setSelectedCostKey(null); setSelectedMvKey(null) }} className={`btn-sm ${allocView === 'assetType' ? 'btn-primary' : 'btn-secondary'}`}>依資產類型</button>
            <button onClick={() => { setAllocView('currency'); setSelectedCostKey(null); setSelectedMvKey(null) }} className={`btn-sm ${allocView === 'currency' ? 'btn-primary' : 'btn-secondary'}`}>依幣別</button>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* 成本配置 */}
          <div className="border border-blue-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-100">
              <span className="font-semibold text-blue-700 text-sm">成本配置</span>
              <span className="text-sm font-bold text-blue-600">{formatCurrency(totalCostTWD, 'TWD')}</span>
            </div>
            {costChartData.length > 0 ? (
              <div className="flex gap-4">
                <div className="shrink-0 w-48">
                  <ResponsiveContainer width={192} height={192}>
                    <PieChart>
                      <Pie data={costChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                        {costChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v, 'TWD')} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5 self-center">
                  {sortedCostAllocation.map((item, i) => (
                    <div key={item.key} onClick={() => setSelectedCostKey(prev => prev === item.key ? null : item.key)} className={`flex items-center justify-between text-lg py-1 border-b border-gray-50 cursor-pointer rounded px-1 transition-colors ${selectedCostKey === item.key ? 'bg-blue-50' : 'hover:bg-blue-50/40'}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="font-medium truncate">{item.label}</span>
                        <span className="text-gray-400">{formatPercent(item.currentPercent)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-600">{formatCurrency(item.currentAmountTWD, 'TWD')}</span>
                        {item.targetPercent > 0 && (
                          item.isWithinTolerance
                            ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                            : <AlertCircle className="w-3 h-3 text-orange-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">尚無資料</div>
            )}
            {selectedCostKey && (
              <div className="mt-3 border border-blue-200 rounded-lg p-3 bg-blue-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-700">{costDetailLabel} · 成本明細</span>
                  <button onClick={() => setSelectedCostKey(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                {costDetailRows.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-blue-100">
                        <th className="text-left py-1 font-medium">資產名稱</th>
                        <th className="text-right py-1 font-medium">買入平均價格</th>
                        <th className="text-right py-1 font-medium">買入均價 (TWD)</th>
                        <th className="text-right py-1 font-medium">成本匯率</th>
                        <th className="text-right py-1 font-medium">數量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costDetailRows.map((asset) => {
                        const costFx = (asset.fxRateToBase != null && asset.fxRateToBase > 0)
                          ? asset.fxRateToBase
                          : asset.currency === 'TWD' ? 1
                          : asset.currency === 'USD' && exchangeRate?.usdRate ? exchangeRate.usdRate
                          : asset.currency === 'JPY' && exchangeRate?.jpyRate ? exchangeRate.jpyRate
                          : asset.currency === 'CNY' && exchangeRate?.cnyRate ? exchangeRate.cnyRate
                          : 1
                        return (
                          <tr key={asset.id} className="border-b border-blue-50">
                            <td className="py-1 pr-2">{asset.name}</td>
                            <td className="py-1 text-right font-mono text-gray-600">
                              {asset.buyPrice != null ? `${asset.buyPrice.toLocaleString()} ${asset.currency}` : '—'}
                            </td>
                            <td className="py-1 text-right font-mono">{formatCurrency((asset.buyPrice ?? 0) * costFx, 'TWD')}</td>
                            <td className="py-1 text-right font-mono text-gray-500">
                              {asset.currency === 'TWD' ? '1' : (asset.fxRateToBase != null && asset.fxRateToBase > 0) ? asset.fxRateToBase.toFixed(4) : '—'}
                            </td>
                            <td className="py-1 text-right font-mono">{(asset.quantity ?? 0).toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-2">無持倉資料</div>
                )}
              </div>
            )}
          </div>
          {/* 市值配置 */}
          <div className="border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-100">
              <span className="font-semibold text-emerald-700 text-sm">市值配置</span>
              <span className="text-sm font-bold text-emerald-600">{formatCurrency(totalMvTWD, 'TWD')}</span>
            </div>
            {mvChartData.length > 0 ? (
              <div className="flex gap-4">
                <div className="shrink-0 w-48">
                  <ResponsiveContainer width={192} height={192}>
                    <PieChart>
                      <Pie data={mvChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                        {mvChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v, 'TWD')} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5 self-center">
                  {sortedMvAllocation.map((item, i) => (
                    <div key={item.key} onClick={() => setSelectedMvKey(prev => prev === item.key ? null : item.key)} className={`flex items-center justify-between text-lg py-1 border-b border-gray-50 cursor-pointer rounded px-1 transition-colors ${selectedMvKey === item.key ? 'bg-emerald-50' : 'hover:bg-emerald-50/40'}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="font-medium truncate">{item.label}</span>
                        <span className="text-gray-400">{formatPercent(item.currentPercent)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-600">{formatCurrency(item.currentAmountTWD, 'TWD')}</span>
                        {item.targetPercent > 0 && (
                          item.isWithinTolerance
                            ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                            : <AlertCircle className="w-3 h-3 text-orange-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">尚無資料（需設定現價）</div>
            )}
            {selectedMvKey && (
              <div className="mt-3 border border-emerald-200 rounded-lg p-3 bg-emerald-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-emerald-700">{mvDetailLabel} · 市值明細</span>
                  <button onClick={() => setSelectedMvKey(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                {mvDetailAssets.length > 0 && (
                  <table className="w-full text-xs mb-2">
                    <thead>
                      <tr className="text-gray-500 border-b border-emerald-100">
                        <th className="text-left py-1 font-medium">資產名稱</th>
                        <th className="text-right py-1 font-medium">幣別</th>
                        <th className="text-right py-1 font-medium">現價</th>
                        <th className="text-right py-1 font-medium">數量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mvDetailAssets.map(asset => (
                        <tr key={asset.id} className="border-b border-emerald-50">
                          <td className="py-1 pr-2">{asset.name}</td>
                          <td className="py-1 text-right font-mono text-gray-500">{asset.currency}</td>
                          <td className="py-1 text-right font-mono">{formatCurrency(asset.currentPrice ?? 0, asset.currency)}</td>
                          <td className="py-1 text-right font-mono">{(asset.quantity ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {mvShowAccounts && accountsToShow.length > 0 && (
                  <>
                    {mvDetailAssets.length > 0 && <div className="text-xs font-semibold text-emerald-700 mb-1 mt-2">帳戶現金</div>}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-emerald-100">
                          <th className="text-left py-1 font-medium">帳戶名稱</th>
                          <th className="text-right py-1 font-medium">幣別</th>
                          <th className="text-right py-1 font-medium">現有資金</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountsToShow.map(acc => (
                          <tr key={acc.id} className="border-b border-emerald-50">
                            <td className="py-1 pr-2">{acc.name}</td>
                            <td className="py-1 text-right font-mono text-gray-500">{acc.currency}</td>
                            <td className="py-1 text-right font-mono">{formatCurrency(acc.balance, acc.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {mvDetailAssets.length === 0 && (!mvShowAccounts || accountsToShow.length === 0) && (
                  <div className="text-xs text-gray-400 text-center py-2">無持倉資料</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">目標配置設定</h3>
          <div className="flex gap-2">
            <button onClick={() => setTableView('cost')} className={`btn-sm ${tableView === 'cost' ? 'btn-primary' : 'btn-secondary'}`}>依成本</button>
            <button onClick={() => setTableView('mv')} className={`btn-sm ${tableView === 'mv' ? 'btn-primary' : 'btn-secondary'}`}>依市値</button>
          </div>
        </div>
        {rebalanceTargets.length === 0 ? (
          <div className="text-center text-gray-400 py-6">尚未設定目標配置</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="標籤" sortKey="label" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="類型" sortKey="targetType" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th>對應項目</th>
                  <SortTh label="目標比例" sortKey="targetPercent" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortTh label="容忍偏差" sortKey="tolerancePercent" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                  <th className="text-right">實際比例</th>
                  <th className="text-right">建議增減</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedTargets.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.label}</td>
                    <td>{t.targetType === 'assetType' ? '資產類型' : '幣別'}</td>
                    <td>
                      {t.targetType === 'assetType'
                        ? ASSET_TYPE_LABELS[t.targetKey as keyof typeof ASSET_TYPE_LABELS] ?? t.targetKey
                        : CURRENCY_LABELS[t.targetKey as keyof typeof CURRENCY_LABELS] ?? t.targetKey}
                    </td>
                    <td className="text-right">{formatPercent(t.targetPercent)}</td>
                    <td className="text-right">±{formatPercent(t.tolerancePercent)}</td>
                    <td className="text-right">{formatPercent(getActualPercent(t))}</td>
                    <td className="text-right">
                      {(() => {
                        const actual = getActualPercent(t)
                        const diff = t.targetPercent - actual
                        const outOfTolerance = Math.abs(actual - t.targetPercent) > t.tolerancePercent
                        const cls = !outOfTolerance ? 'text-gray-600' : diff < 0 ? 'font-bold text-green-600' : 'font-bold text-red-500'
                        return (
                          <span className={cls}>
                            {diff >= 0 ? '+' : ''}{formatPercent(diff)}
                          </span>
                        )
                      })()}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? '編輯目標配置' : '新增目標配置'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label className="label">標籤 *</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="例：台股部位" />
            {errors.label && <span className="text-xs text-red-500">{errors.label}</span>}
          </div>
          <div className="form-group">
            <label className="label">分類方式</label>
            <select className="select" value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value as RebalanceTargetInput['targetType'], targetKey: e.target.value === 'assetType' ? 'tw_stock' : 'TWD' })}>
              <option value="assetType">資產類型</option>
              <option value="currency">幣別</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">對應項目</label>
            <select className="select" value={form.targetKey} onChange={(e) => setForm({ ...form, targetKey: e.target.value })}>
              {form.targetType === 'assetType'
                ? ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>)
                : CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">目標比例 (%)</label>
            <input type="number" min="0" max="100" step="1" className="input" value={(form.targetPercent * 100).toFixed(0)} onChange={(e) => setForm({ ...form, targetPercent: Number(e.target.value) / 100 })} />
          </div>
          <div className="form-group">
            <label className="label">容忍偏差 (%)</label>
            <input type="number" min="0" max="100" step="1" className="input" value={(form.tolerancePercent * 100).toFixed(0)} onChange={(e) => setForm({ ...form, tolerancePercent: Number(e.target.value) / 100 })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">儲存</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="刪除目標配置"
        message="確定要刪除此目標配置嗎？"
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  )
}