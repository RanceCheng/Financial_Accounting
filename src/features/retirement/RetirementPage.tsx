import { useState, useCallback, useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  TooltipProps,
} from 'recharts'
import { PlayCircle, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Info, ArrowDownToLine } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { calcAllocationByAssetTypeMarketValue, calcMonthlySummaries } from '@/data/services'
import { runMonteCarlo, SimParams, SimResult, ChartPoint } from './monteCarloEngine'

// ── 預設參數 ──
const DEFAULT: SimParams = {
  currentAge: 35,
  retireAge: 65,
  lifeExpectancy: 90,
  currentAssets: 1_000_000,
  monthlyInvestment: 20_000,
  annualReturn: 0.07,
  annualVolatility: 0.15,
  monthlyExpense: 50_000,
  inflationRate: 0.02,
  simCount: 1000,
}

// ── 格式化輔助 ──
function formatTWD(v: number): string {
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(2)} 兆`
  if (v >= 100_000_000)       return `${(v / 100_000_000).toFixed(2)} 億`
  if (v >= 10_000)            return `${(v / 10_000).toLocaleString('zh-TW', { maximumFractionDigits: 0 })} 萬`
  return `${Math.round(v).toLocaleString('zh-TW')}`
}
function pct(v: number) {
  return `${(v * 100).toFixed(1)} %`
}

// ── 成功率顏色 ──
function successColor(rate: number) {
  if (rate >= 0.9) return { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', icon: CheckCircle2 }
  if (rate >= 0.7) return { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', icon: AlertTriangle }
  return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', icon: AlertTriangle }
}

// ── 圖表轉換（分帶 Area + Line） ──
type BandPoint = {
  age: number
  base: number    // P10 (transparent base)
  band1: number   // P25 - P10
  band2: number   // P75 - P25
  band3: number   // P90 - P75
  p50: number     // absolute, for Line
  // raw for tooltip
  _p10: number; _p25: number; _p75: number; _p90: number
}

function toBandData(data: ChartPoint[]): BandPoint[] {
  return data.map(d => ({
    age: d.age,
    base:  d.p10,
    band1: Math.max(0, d.p25 - d.p10),
    band2: Math.max(0, d.p75 - d.p25),
    band3: Math.max(0, d.p90 - d.p75),
    p50:   d.p50,
    _p10: d.p10, _p25: d.p25, _p75: d.p75, _p90: d.p90,
  }))
}

// ── 自訂 Tooltip ──
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as BandPoint
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[130px]">
      <p className="font-semibold text-slate-700 mb-1.5">{label} 歲</p>
      {([['P90', d._p90, '#94a3b8'], ['P75', d._p75, '#60a5fa'], ['P50 中位數', d.p50, '#2563eb'], ['P25', d._p25, '#60a5fa'], ['P10', d._p10, '#94a3b8']] as [string, number, string][]).map(([name, val, color]) => (
        <div key={name} className="flex justify-between gap-4">
          <span style={{ color }} className="font-medium">{name}</span>
          <span className="text-slate-700">{formatTWD(val)}</span>
        </div>
      ))}
    </div>
  )
}

// ── 數字輸入列 ──
interface InputRowProps {
  label: string
  subLabel?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}

function InputRow({ label, subLabel, value, onChange, min, max, step = 1, suffix }: InputRowProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {subLabel && <span className="text-xs text-slate-400 ml-1">({subLabel})</span>}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          className="input flex-1 min-w-0"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
        />
        {suffix && <span className="text-sm text-slate-500 shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

// ── 驗證 ──
function validate(p: SimParams): string | null {
  if (p.retireAge <= p.currentAge) return '退休年齡必須大於目前年齡'
  if (p.lifeExpectancy <= p.retireAge) return '預期壽命必須大於退休年齡'
  if (p.currentAge < 1 || p.currentAge > 100) return '年齡範圍不合理'
  if (p.annualReturn < -0.5 || p.annualReturn > 1) return '年化報酬率範圍不合理（-50% ~ 100%）'
  if (p.annualVolatility < 0 || p.annualVolatility > 1) return '年化波動率範圍不合理（0% ~ 100%）'
  if (p.inflationRate < 0 || p.inflationRate > 0.5) return '通膨率範圍不合理'
  if (p.simCount < 100 || p.simCount > 10000) return '模擬次數需在 100 ~ 10,000 之間'
  return null
}

// ============================================================
// 主頁面
// ============================================================

export function RetirementPage() {
  const [params, setParams] = useState<SimParams>(DEFAULT)
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // ── 帶入資料：再平衡總資產（市值）──
  const assets    = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const accounts  = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const exchangeRate = useLiveQuery(() => db.exchangeRates.get('current'), [])
  const totalMvTWD = useMemo(() => {
    const alloc = calcAllocationByAssetTypeMarketValue(assets, exchangeRate, [], accounts)
    return alloc.reduce((s, a) => s + a.currentAmountTWD, 0)
  }, [assets, accounts, exchangeRate])

  // ── 帶入資料：收支月結餘（最近一個有紀錄的月份）──
  const cashRecords = useLiveQuery(() => db.incomeExpenseRecords.toArray(), []) ?? []
  const cashPlans   = useLiveQuery(() => db.monthlyExpensePlans.toArray(), []) ?? []
  const latestMonthBalance = useMemo(() => {
    const summaries = calcMonthlySummaries(cashRecords, cashPlans)
    if (summaries.length === 0) return null
    // 最近一個月（summaries 已按時間排序，取最後一筆）
    const last = summaries[summaries.length - 1]
    return { balance: last.balance, yearMonth: last.yearMonth }
  }, [cashRecords, cashPlans])

  const set = useCallback(<K extends keyof SimParams>(key: K, val: SimParams[K]) => {
    setParams(prev => ({ ...prev, [key]: val }))
  }, [])

  const runSim = useCallback(() => {
    const err = validate(params)
    if (err) { setErrMsg(err); return }
    setErrMsg(null)
    setLoading(true)
    setTimeout(() => {
      try {
        const r = runMonteCarlo(params)
        setResult(r)
      } catch (e) {
        setErrMsg(`模擬失敗：${e}`)
      } finally {
        setLoading(false)
      }
    }, 10)
  }, [params])

  const bandData = result ? toBandData(result.chartData) : []

  // Y 軸單位：依最大資產值自動切換萬/億/兆
  const maxBandVal = bandData.length > 0
    ? Math.max(...bandData.map(d => d.base + d.band1 + d.band2 + d.band3))
    : 0
  const [yUnit, yDiv] = maxBandVal >= 1e12 ? ['兆', 1e12]
    : maxBandVal >= 1e8 ? ['億', 1e8]
    : ['萬', 1e4]
  const yAxisFormatter = (v: number) => {
    const n = v / yDiv
    return `${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)}${yUnit}`
  }
  const successCfg = result ? successColor(result.successRate) : null
  const SuccessIcon = successCfg?.icon

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-500" />
          退休規劃試算
        </h1>
        <p className="text-sm text-slate-500 mt-1">蒙地卡羅模擬 — 以隨機報酬路徑評估退休計畫的成功機率</p>
      </div>

      {/* 參數設定 */}
      <section className="card p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-700">參數設定</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 年齡 */}
          <InputRow label="目前年齡" suffix="歲" value={params.currentAge} onChange={v => set('currentAge', v)} min={1} max={99} />
          <InputRow label="退休年齡" suffix="歲" value={params.retireAge} onChange={v => set('retireAge', v)} min={1} max={100} />
          <InputRow label="預期壽命" suffix="歲" value={params.lifeExpectancy} onChange={v => set('lifeExpectancy', v)} min={1} max={120} />

          {/* 資產 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                目前總資產
                <span className="text-xs text-slate-400 ml-1">(TWD)</span>
              </label>
              <button
                type="button"
                onClick={() => { if (totalMvTWD > 0) set('currentAssets', Math.round(totalMvTWD)) }}
                disabled={totalMvTWD <= 0}
                title={totalMvTWD > 0 ? `帶入再平衡表總資產（市值）：${Math.round(totalMvTWD).toLocaleString('zh-TW')} 元` : '再平衡表無資料'}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowDownToLine className="w-3 h-3" />
                帶入總資產
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                className="input flex-1 min-w-0"
                value={params.currentAssets}
                min={0}
                step={10000}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) set('currentAssets', v) }}
              />
              <span className="text-sm text-slate-500 shrink-0">元</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                退休前每月投入
                <span className="text-xs text-slate-400 ml-1">(TWD)</span>
              </label>
              <button
                type="button"
                onClick={() => { if (latestMonthBalance && latestMonthBalance.balance > 0) set('monthlyInvestment', Math.round(latestMonthBalance.balance)) }}
                disabled={!latestMonthBalance || latestMonthBalance.balance <= 0}
                title={
                  latestMonthBalance
                    ? `帶入 ${latestMonthBalance.yearMonth} 月結餘：${Math.round(latestMonthBalance.balance).toLocaleString('zh-TW')} 元`
                    : '收支表無月結餘資料'
                }
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-green-300 text-green-600 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowDownToLine className="w-3 h-3" />
                帶入月結餘
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                className="input flex-1 min-w-0"
                value={params.monthlyInvestment}
                min={0}
                step={1000}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) set('monthlyInvestment', v) }}
              />
              <span className="text-sm text-slate-500 shrink-0">元</span>
            </div>
          </div>
          <InputRow label="退休後每月支出" subLabel="今日幣值 TWD" suffix="元" value={params.monthlyExpense} onChange={v => set('monthlyExpense', v)} min={0} step={1000} />

          {/* 報酬 / 風險 */}
          <InputRow label="年化預期報酬率" value={parseFloat((params.annualReturn * 100).toFixed(2))} onChange={v => set('annualReturn', v / 100)} step={0.1} min={-50} max={100} suffix="%" />
          <InputRow label="年化波動率 (σ)" value={parseFloat((params.annualVolatility * 100).toFixed(2))} onChange={v => set('annualVolatility', v / 100)} step={0.1} min={0} max={100} suffix="%" />
          <InputRow label="通膨率" value={parseFloat((params.inflationRate * 100).toFixed(2))} onChange={v => set('inflationRate', v / 100)} step={0.1} min={0} max={50} suffix="%" />

          {/* 模擬次數 */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">模擬次數</label>
            <div className="flex gap-1.5 flex-wrap">
              {[500, 1000, 2000, 5000].map(n => (
                <button
                  key={n}
                  onClick={() => set('simCount', n)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${params.simCount === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {errMsg && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errMsg}
          </div>
        )}

        <button
          onClick={runSim}
          disabled={loading}
          className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          {loading
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <PlayCircle className="w-4 h-4" />
          }
          {loading ? `模擬中（${params.simCount.toLocaleString()} 次）…` : '執行模擬'}
        </button>
      </section>

      {/* 結果 */}
      {result && (
        <>
          {/* 摘要 Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 成功率 */}
            <div className={`card p-4 border ${successCfg?.bg} ${successCfg?.border}`}>
              <div className="flex items-center gap-1.5 mb-1">
                {SuccessIcon && <SuccessIcon className={`w-4 h-4 ${successCfg?.text}`} />}
                <span className="text-xs font-medium text-slate-500">成功率</span>
              </div>
              <div className={`text-2xl font-bold ${successCfg?.text}`}>{pct(result.successRate)}</div>
              <p className="text-xs text-slate-400 mt-1">壽命內資產不耗盡</p>
            </div>

            {/* 退休時資產中位數 */}
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-500 mb-1">退休時資產（中位數）</div>
              <div className="text-2xl font-bold text-slate-800">{formatTWD(result.retireMedianAsset)}</div>
              <p className="text-xs text-slate-400 mt-1">{params.retireAge} 歲時</p>
            </div>

            {/* 資產耗盡中位年齡 */}
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-500 mb-1">資產耗盡中位年齡</div>
              {result.depletionMedianAge ? (
                <div className="text-2xl font-bold text-red-600">{result.depletionMedianAge} 歲</div>
              ) : (
                <div className="text-2xl font-bold text-green-600">—</div>
              )}
              <p className="text-xs text-slate-400 mt-1">{result.depletionMedianAge ? '超過半數模擬耗盡' : '超過半數模擬存活'}</p>
            </div>

            {/* 退休年期 */}
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-500 mb-1">退休年期</div>
              <div className="text-2xl font-bold text-slate-800">{params.lifeExpectancy - params.retireAge} 年</div>
              <p className="text-xs text-slate-400 mt-1">{params.retireAge} ~ {params.lifeExpectancy} 歲</p>
            </div>
          </div>

          {/* 圖表 */}
          <section className="card p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-slate-700">資產路徑分佈</h2>
                <p className="text-xs text-slate-400 mt-0.5">深藍帶 = P25~P75（50% 情境），淺藍帶 = P10~P25 / P75~P90，實線 = 中位數</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                模擬次數 {params.simCount.toLocaleString()} 次
              </div>
            </div>

            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={bandData} margin={{ top: 8, right: 8, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="age"
                  label={{ value: '年齡（歲）', position: 'insideBottom', offset: -2, fontSize: 12, fill: '#94a3b8' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  tickFormatter={yAxisFormatter}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={72}
                />
                <Tooltip content={<ChartTooltip />} />

                {/* 百分位帶（Stacked Area） */}
                <Area type="monotone" dataKey="base"  stackId="b" fill="transparent" stroke="none" legendType="none" />
                <Area type="monotone" dataKey="band1" stackId="b" fill="#bfdbfe" stroke="none" fillOpacity={0.7} name="P10–P25" legendType="square" />
                <Area type="monotone" dataKey="band2" stackId="b" fill="#3b82f6" stroke="none" fillOpacity={0.35} name="P25–P75" legendType="square" />
                <Area type="monotone" dataKey="band3" stackId="b" fill="#bfdbfe" stroke="none" fillOpacity={0.7} name="P75–P90" legendType="square" />

                {/* 中位數線 */}
                <Line type="monotone" dataKey="p50" stroke="#1d4ed8" strokeWidth={2.5} dot={false} name="中位數 (P50)" legendType="line" />

                {/* 退休年齡參考線 */}
                <ReferenceLine
                  x={params.retireAge}
                  stroke="#ef4444"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{ value: `退休 ${params.retireAge}歲`, position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }}
                />

                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                  formatter={(value) => <span className="text-slate-600">{value}</span>}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* 說明 */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
              <p><strong>如何解讀：</strong>每條路徑代表一種隨機報酬情境。成功率越高（建議 ≥ 90%），退休計畫越穩健。</p>
              <p>退休後支出已依通膨率逐年調整；波動率設定越高，帶狀範圍越寬。</p>
              <p className="text-blue-500">⚠ 本工具僅供規劃參考，不構成投資建議。實際報酬可能與假設差異顯著。</p>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
