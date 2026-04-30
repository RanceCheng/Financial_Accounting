import { useState } from 'react'
import { SortTh } from '@/components/common/SortTh'
import { useSortable, sortByKey } from '@/lib/sorting'
import { FundAnalysisRow } from '../types/investmentAnalysis'

interface Props {
  rows: FundAnalysisRow[]
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


export function FundAnalysisTable({ rows }: Props) {
  const [showClosed, setShowClosed] = useState(false)
  const { sortKey, sortDir, handleSort } = useSortable('marketValueTWD', 'desc')

  const displayed = showClosed ? rows : rows.filter(r => r.quantity > 0)
  const sorted = sortByKey(displayed, sortKey, sortDir, (r, k) => (r as unknown as Record<string, unknown>)[k] as number | string)

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        {rows.length === 0 ? '尚無基金資料（assetType = fund）' : '目前無持有中的基金'}
        {rows.some(r => r.quantity <= 0) && !showClosed && (
          <button onClick={() => setShowClosed(true)} className="ml-2 text-blue-500 underline">顯示已出清</button>
        )}
      </div>
    )
  }

  const thCls = 'px-2 py-2 text-right text-xs font-medium text-slate-500 whitespace-nowrap'
  const thLCls = 'px-2 py-2 text-left text-xs font-medium text-slate-500 whitespace-nowrap'

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
          <thead className="bg-amber-50 border-b border-amber-200">
            <tr>
              <th className={thLCls}>基金</th>
              <th className={thLCls}>幣別</th>
              <SortTh label="單位數"       sortKey="quantity"                         current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <th className={thCls}>均申購</th>
              <th className={thCls}>目前淨值</th>
              <SortTh label="成本(TWD)"    sortKey="costBasisTWD"                     current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="市值(TWD)"    sortKey="marketValueTWD"                   current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="淨值損益"      sortKey="navPnLTWD"                        current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="淨值%"         sortKey="navReturnRate"                    current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="累積淨配息"    sortKey="totalNetDistributionsTWD"         current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="配息率%"       sortKey="distributionReturnRate"           current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="含息總報酬"    sortKey="totalReturnWithDistributionTWD"   current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="含息報酬%"     sortKey="totalReturnWithDistributionRate"  current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="近12月配息"    sortKey="trailing12MonthNetDistributionsTWD" current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="近12月殖利率%" sortKey="trailing12MonthYield"             current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <SortTh label="成本殖利率%"   sortKey="yieldOnCost"                      current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
              <th className={thCls}>最後配息日</th>
              <SortTh label="占比"          sortKey="portfolioWeight"                  current={sortKey} dir={sortDir} onSort={handleSort} className={thCls} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(r => (
              <tr key={r.assetId} className={`hover:bg-amber-50/30 ${r.quantity <= 0 ? 'opacity-50' : ''}`}>
                <td className="px-2 py-2 whitespace-nowrap">
                  <div className="font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.ticker}</div>
                </td>
                <td className="px-2 py-2">
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 rounded text-amber-700">{r.currency}</span>
                </td>
                <td className="px-2 py-2 text-right text-slate-700">{r.quantity.toLocaleString('zh-TW', { maximumFractionDigits: 4 })}</td>
                <td className="px-2 py-2 text-right text-slate-600">
                  {r.averageCost > 0 ? r.averageCost.toLocaleString('zh-TW', { maximumFractionDigits: 4 }) : '—'}
                </td>
                <td className="px-2 py-2 text-right text-slate-600">
                  {r.currentPrice > 0 ? r.currentPrice.toLocaleString('zh-TW', { maximumFractionDigits: 4 }) : <span className="text-orange-400">未更新</span>}
                </td>
                <td className="px-2 py-2 text-right text-slate-600">{fmt(r.costBasisTWD)}</td>
                <td className="px-2 py-2 text-right font-medium text-slate-800">{fmt(r.marketValueTWD)}</td>
                <td className={`px-2 py-2 text-right ${pnlClass(r.navPnLTWD)}`}>{fmt(r.navPnLTWD)}</td>
                <td className={`px-2 py-2 text-right ${pnlClass(r.navReturnRate)}`}>{pct(r.navReturnRate)}</td>
                <td className="px-2 py-2 text-right text-red-600">{r.totalNetDistributionsOC > 0 ? fmt(r.totalNetDistributionsOC) : '—'}</td>
                <td className="px-2 py-2 text-right text-slate-600">{pct(r.distributionReturnRate, false)}</td>
                <td className={`px-2 py-2 text-right font-bold ${pnlClass(r.totalReturnWithDistributionTWD)}`}>{fmt(r.totalReturnWithDistributionTWD)}</td>
                <td className={`px-2 py-2 text-right font-bold ${pnlClass(r.totalReturnWithDistributionRate)}`}>{pct(r.totalReturnWithDistributionRate)}</td>
                <td className="px-2 py-2 text-right text-red-600">{r.trailing12MonthNetDistributionsTWD > 0 ? fmt(r.trailing12MonthNetDistributionsTWD) : '—'}</td>
                <td className="px-2 py-2 text-right text-slate-600">{r.trailing12MonthYield > 0 ? pct(r.trailing12MonthYield, false) : '—'}</td>
                <td className="px-2 py-2 text-right text-slate-600">{r.yieldOnCost > 0 ? pct(r.yieldOnCost, false) : '—'}</td>
                <td className="px-2 py-2 text-right text-xs text-slate-500">{r.lastDistributionDate ?? '無'}</td>
                <td className="px-2 py-2 text-right text-slate-600">{(r.portfolioWeight * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
