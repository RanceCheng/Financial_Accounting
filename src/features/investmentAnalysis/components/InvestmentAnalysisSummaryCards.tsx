import { TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react'
import { InvestmentAnalysisSummary } from '../types/investmentAnalysis'

interface Props {
  summary: InvestmentAnalysisSummary
}

function fmt(v: number): string {
  return v.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`
}

function pnlColor(v: number): string {
  if (v > 0) return 'text-red-600'
  if (v < 0) return 'text-green-700'
  return 'text-slate-700'
}

export function InvestmentAnalysisSummaryCards({ summary }: Props) {
  const cards = [
    {
      label: '投資總市值',
      value: fmt(summary.totalMarketValueTWD),
      sub: `成本 ${fmt(summary.totalCostTWD)}`,
      color: 'text-slate-800',
      icon: <Package className="w-4 h-4" />,
    },
    {
      label: '未實現損益',
      value: fmt(summary.unrealizedPnLTWD),
      sub: pct(summary.totalCostTWD > 0 ? summary.unrealizedPnLTWD / summary.totalCostTWD : 0),
      color: pnlColor(summary.unrealizedPnLTWD),
      icon: summary.unrealizedPnLTWD >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
    },
    {
      label: '已實現價差',
      value: fmt(summary.realizedCapitalGainTWD),
      sub: '不含配息',
      color: pnlColor(summary.realizedCapitalGainTWD),
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      label: '累積淨配息',
      value: fmt(summary.totalNetDistributionsTWD),
      sub: '扣稅費後實收',
      color: summary.totalNetDistributionsTWD > 0 ? 'text-red-600' : 'text-slate-700',
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      label: '總報酬',
      value: fmt(summary.totalReturnTWD),
      sub: pct(summary.totalReturnRate),
      color: pnlColor(summary.totalReturnTWD),
      icon: summary.totalReturnTWD >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
    },
    {
      label: '持有標的',
      value: `${summary.holdingAssetCount} 檔`,
      sub: `一般 ${summary.nonFundAssetCount} / 基金 ${summary.fundCount}`,
      color: 'text-slate-800',
      icon: <Package className="w-4 h-4" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <div key={c.label} className="stat-card">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            {c.icon}
            <span>{c.label}</span>
          </div>
          <div className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</div>
          <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
