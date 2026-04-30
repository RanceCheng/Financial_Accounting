import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { AssetAnalysisRow, FundAnalysisRow, InvestmentWarning, InvestmentWarningLevel } from '../types/investmentAnalysis'

interface Props {
  assetRows: AssetAnalysisRow[]
  fundRows: FundAnalysisRow[]
}

interface WarningEntry {
  assetName: string
  ticker: string
  warning: InvestmentWarning
}

const LEVEL_ORDER: Record<InvestmentWarningLevel, number> = { danger: 0, warning: 1, info: 2 }
const LEVEL_CFG = {
  danger:  { cls: 'bg-red-50 border-red-200',         badge: 'bg-red-100 text-red-700',           icon: AlertTriangle, label: '危險' },
  warning: { cls: 'bg-yellow-50 border-yellow-200',   badge: 'bg-yellow-100 text-yellow-700',     icon: AlertCircle,  label: '警告' },
  info:    { cls: 'bg-slate-50 border-slate-200',     badge: 'bg-slate-100 text-slate-500',       icon: Info,         label: '提示' },
}

export function InvestmentWarningsPanel({ assetRows, fundRows }: Props) {
  const entries: WarningEntry[] = []
  for (const r of [...assetRows, ...fundRows]) {
    for (const w of r.warnings) {
      entries.push({ assetName: r.name, ticker: r.ticker, warning: w })
    }
  }

  entries.sort((a, b) => LEVEL_ORDER[a.warning.level] - LEVEL_ORDER[b.warning.level])

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <Info className="w-4 h-4 shrink-0" />
        所有標的均無風險警示
      </div>
    )
  }

  const dangerCount  = entries.filter(e => e.warning.level === 'danger').length
  const warningCount = entries.filter(e => e.warning.level === 'warning').length
  const infoCount    = entries.filter(e => e.warning.level === 'info').length

  return (
    <div className="space-y-2">
      {/* 統計 */}
      <div className="flex gap-2 text-xs">
        {dangerCount  > 0 && <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">{dangerCount} 危險</span>}
        {warningCount > 0 && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">{warningCount} 警告</span>}
        {infoCount    > 0 && <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full">{infoCount} 提示</span>}
      </div>

      {/* 警示列表 */}
      <div className="space-y-1.5">
        {entries.map((e, i) => {
          const cfg = LEVEL_CFG[e.warning.level]
          const Icon = cfg.icon
          return (
            <div key={i} className={`flex items-start gap-3 border rounded-lg px-3 py-2.5 ${cfg.cls}`}>
              <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: e.warning.level === 'danger' ? '#dc2626' : e.warning.level === 'warning' ? '#d97706' : '#94a3b8' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-slate-800">{e.assetName}</span>
                  {e.ticker && <span className="text-xs text-slate-400">{e.ticker}</span>}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{e.warning.message}</p>
              </div>
              {e.warning.metric != null && (
                <span className="text-xs text-slate-500 shrink-0">{(e.warning.metric * 100).toFixed(1)}%</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
