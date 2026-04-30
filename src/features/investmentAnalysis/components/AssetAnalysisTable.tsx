import { useState } from 'react'
import { SortTh } from '@/components/common/SortTh'
import { useSortable, sortByKey } from '@/lib/sorting'
import { ASSET_TYPE_LABELS, MARKET_LABELS } from '@/lib/constants'
import { AssetAnalysisRow } from '../types/investmentAnalysis'

interface Props {
  rows: AssetAnalysisRow[]
}

function fmt(v: number): string {
  return v.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

function pct(v: number, sign = true): string {
  return `${sign && v > 0 ? '+' : ''}${(v * 100).toFixed(2)}%`
}

function pnlClass(v: number): string {
  if (v > 0) return 'text-red-600 font-medium'
  if (v < 0) return 'text-green-700 font-medium'
  return 'text-slate-600'
}


export function AssetAnalysisTable({ rows }: Props) {
  const [showClosed, setShowClosed] = useState(false)
  const { sortKey, sortDir, handleSort } = useSortable('marketValueTWD', 'desc')

  const displayed = (showClosed ? rows : rows.filter(r => r.quantity > 0))
  const sorted = sortByKey(displayed, sortKey, sortDir, (r, k) => (r as unknown as Record<string, unknown>)[k] as number | string)

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        {rows.length === 0 ? '尚無一般標的資料' : '目前無持有中的一般標的'}
        {rows.some(r => r.quantity <= 0) && !showClosed && (
          <button onClick={() => setShowClosed(true)} className="ml-2 text-blue-500 underline">顯示已出清</button>
        )}
      </div>
    )
  }

  const thCls = 'px-3 py-2 text-right text-xs font-medium text-slate-500 whitespace-nowrap'
  const thLCls = 'px-3 py-2 text-left text-xs font-medium text-slate-500 whitespace-nowrap'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{sorted.length} 筆</span>
        <label className="flex items-center gap-1.5 text-sm text-slate-500 cursor-pointer select-none">
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="rounded" />
          顯示已出清
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thLCls}>標的</th>
              <th className={thLCls}>市場</th>
              <SortTh label="持有數量" sortKey="quantity"             current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="平均成本" sortKey="averageCost"          current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <th className={thCls}>現價</th>
              <SortTh label="成本(TWD)" sortKey="costBasisTWD"         current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="市值(TWD)" sortKey="marketValueTWD"       current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="未實現損益" sortKey="unrealizedPnLTWD"    current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="未實現%" sortKey="unrealizedReturnRate"   current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="已實現價差" sortKey="realizedCapitalGainTWD" current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="累積股息" sortKey="totalNetDistributionsTWD" current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="總報酬"   sortKey="totalReturnTWD"        current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="總報酬%" sortKey="totalReturnRate"         current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="占比"     sortKey="portfolioWeight"        current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(r => (
              <tr key={r.assetId} className={`hover:bg-slate-50 ${r.quantity <= 0 ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.ticker} · {ASSET_TYPE_LABELS[r.assetType]}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{MARKET_LABELS[r.market]}</span>
                  <span className="ml-1 text-xs px-1.5 py-0.5 bg-blue-50 rounded text-blue-600">{r.currency}</span>
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{r.quantity.toLocaleString('zh-TW', { maximumFractionDigits: 4 })}</td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {r.averageCost > 0 ? r.averageCost.toLocaleString('zh-TW', { maximumFractionDigits: 2 }) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {r.currentPrice > 0 ? r.currentPrice.toLocaleString('zh-TW', { maximumFractionDigits: 4 }) : <span className="text-orange-400">未更新</span>}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">{fmt(r.costBasisTWD)}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-800">{fmt(r.marketValueTWD)}</td>
                <td className={`px-3 py-2 text-right ${pnlClass(r.unrealizedPnLTWD)}`}>{fmt(r.unrealizedPnLTWD)}</td>
                <td className={`px-3 py-2 text-right ${pnlClass(r.unrealizedReturnRate)}`}>{pct(r.unrealizedReturnRate)}</td>
                <td className={`px-3 py-2 text-right ${pnlClass(r.realizedCapitalGainTWD)}`}>{fmt(r.realizedCapitalGainTWD)}</td>
                <td className="px-3 py-2 text-right text-red-600">{r.totalNetDistributionsTWD > 0 ? fmt(r.totalNetDistributionsTWD) : '—'}</td>
                <td className={`px-3 py-2 text-right ${pnlClass(r.totalReturnTWD)}`}>{fmt(r.totalReturnTWD)}</td>
                <td className={`px-3 py-2 text-right ${pnlClass(r.totalReturnRate)}`}>{pct(r.totalReturnRate)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{(r.portfolioWeight * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
