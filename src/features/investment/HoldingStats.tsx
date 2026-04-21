import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { calcAllHoldings } from '@/data/services'
import { formatCurrency } from '@/lib/formatters'
import { StatCard } from '@/components/common/StatCard'
import { TrendingUp, Package, DollarSign, Activity } from 'lucide-react'

export function HoldingStats() {
  const transactions = useLiveQuery(() => db.investmentTransactions.toArray(), []) ?? []
  const assets = useLiveQuery(() => db.assets.toArray(), []) ?? []

  const stats = useMemo(() => {
    const holdings = calcAllHoldings(transactions, assets)

    let totalCostTWD = 0
    let totalSellTWD = 0
    let totalRealizedPnL = 0
    let activePositions = 0

    for (const h of holdings) {
      totalCostTWD += h.totalCost
      totalRealizedPnL += h.realizedPnL
      if (h.quantity > 0) activePositions++
    }

    // Sell revenue
    for (const tx of transactions) {
      if (tx.txType === 'sell' || tx.txType === 'dividend') {
        totalSellTWD += tx.quantity * tx.price * tx.fxRateToBase
      }
    }

    return { totalCostTWD, totalSellTWD, totalRealizedPnL, activePositions }
  }, [transactions, assets])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="總投入金額 (TWD)"
        value={formatCurrency(stats.totalCostTWD, 'TWD')}
        icon={<DollarSign className="w-4 h-4" />}
      />
      <StatCard
        label="總賣出金額 (TWD)"
        value={formatCurrency(stats.totalSellTWD, 'TWD')}
        icon={<TrendingUp className="w-4 h-4" />}
      />
      <StatCard
        label="已實現損益 (TWD)"
        value={formatCurrency(stats.totalRealizedPnL, 'TWD')}
        colorClass={stats.totalRealizedPnL >= 0 ? 'text-green-600' : 'text-red-500'}
        icon={<Activity className="w-4 h-4" />}
      />
      <StatCard
        label="持倉標的數"
        value={`${stats.activePositions} 檔`}
        icon={<Package className="w-4 h-4" />}
      />
    </div>
  )
}
