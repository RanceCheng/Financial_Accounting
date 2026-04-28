import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'

import { formatCurrency } from '@/lib/formatters'
import { StatCard } from '@/components/common/StatCard'
import { TrendingUp, Package, DollarSign, Activity, Wallet, BarChart2 } from 'lucide-react'

import type { TxFilters } from './TransactionList'

export function HoldingStats({ txFilters }: { txFilters?: TxFilters }) {
  const dateFrom = txFilters?.dateFrom ?? ''
  const dateTo = txFilters?.dateTo ?? ''
  const filterCurrency = txFilters?.currency ?? ''
  const filterAccountId = txFilters?.accountId ?? ''
  const filterMarket = txFilters?.market ?? ''
  const filterAssetType = txFilters?.assetType ?? ''
  const filterKeyword = txFilters?.keyword ?? ''
  const transactions = useLiveQuery(() => db.investmentTransactions.toArray(), []) ?? []
  const assets = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const exchangeRate = useLiveQuery(() => db.exchangeRates.get('current'), [])

  const stats = useMemo(() => {
    // 以即時匯率將任意幣別換算為 TWD
    const getFx = (currency: string): number => {
      if (!exchangeRate || currency === 'TWD') return 1
      if (currency === 'USD' && exchangeRate.usdRate > 0) return exchangeRate.usdRate
      if (currency === 'JPY' && exchangeRate.jpyRate > 0) return exchangeRate.jpyRate
      if (currency === 'CNY' && exchangeRate.cnyRate > 0) return exchangeRate.cnyRate
      return 1
    }

    // 以即時匯率重算成本、賣出、已實現損益（追蹤各資產成本基礎）
    // 依日期區間篩選（現金/未實現損益為即時數值，不受篩選影響）
    const filteredTxs = transactions.filter((tx) => {
      const d = tx.date.slice(0, 10)
      if (dateFrom && d < dateFrom) return false
      if (dateTo && d > dateTo) return false
      if (filterCurrency && tx.currency !== filterCurrency) return false
      if (filterAccountId && tx.accountId !== filterAccountId) return false
      const asset = assets.find(a => a.id === tx.assetId)
      if (filterMarket && asset?.market !== filterMarket) return false
      if (filterAssetType && asset?.assetType !== filterAssetType) return false
      if (filterKeyword) {
        const kw = filterKeyword.toLowerCase()
        const name = asset?.name.toLowerCase() ?? ''
        const ticker = asset?.ticker.toLowerCase() ?? ''
        const note = tx.note?.toLowerCase() ?? ''
        if (!name.includes(kw) && !ticker.includes(kw) && !note.includes(kw)) return false
      }
      return true
    })
    const basis = new Map<string, { qty: number; cost: number; pnl: number }>()
    let totalSellTWD = 0

    for (const tx of filteredTxs) {
      // 優先使用交易紀錄的成本匯率，無紀錄才 fallback 即時匯率
      const fx = (tx.fxRateToBase > 0) ? tx.fxRateToBase : getFx(tx.currency)
      const netAmt = tx.quantity * tx.price * fx
      if (!basis.has(tx.assetId)) basis.set(tx.assetId, { qty: 0, cost: 0, pnl: 0 })
      const b = basis.get(tx.assetId)!
      if (tx.txType === 'buy' || tx.txType === 'deposit') {
        b.qty += tx.quantity
        b.cost += netAmt + (tx.fee + tx.tax) * fx
      } else if (tx.txType === 'sell' || tx.txType === 'withdrawal') {
        const avgCost = b.qty > 0 ? b.cost / b.qty : 0
        const costOfSold = avgCost * tx.quantity
        b.pnl += netAmt - (tx.fee + tx.tax) * fx - costOfSold
        b.qty = Math.max(0, b.qty - tx.quantity)
        b.cost = Math.max(0, b.cost - costOfSold)
        totalSellTWD += netAmt
      } else if (tx.txType === 'dividend') {
        b.pnl += netAmt - (tx.fee + tx.tax) * fx
        totalSellTWD += netAmt
      } else if (tx.txType === 'fee' || tx.txType === 'tax') {
        b.cost += (tx.fee + tx.tax) * fx
      }
    }

    let totalCostTWD = 0
    let totalRealizedPnL = 0
    let activePositions = 0
    for (const b of basis.values()) {
      totalCostTWD += b.cost
      totalRealizedPnL += b.pnl
      if (b.qty > 0) activePositions++
    }

    // 現有資金：所有帳戶 balance 換算為 TWD
    let totalBalanceTWD = 0
    for (const acc of accounts) {
      totalBalanceTWD += (acc.balance ?? 0) * getFx(acc.currency)
    }

    // 未實現損益：現值用即時匯率，成本用加權平均成本匯率（a.fxRateToBase）
    let totalUnrealizedPnLTWD = 0
    for (const a of assets) {
      if (a.currentPrice == null || a.quantity == null) continue
      const currentFx = getFx(a.currency)
      const costFx = (a.fxRateToBase != null && a.fxRateToBase > 0) ? a.fxRateToBase : currentFx
      totalUnrealizedPnLTWD +=
        a.currentPrice * a.quantity * currentFx -
        (a.buyPrice ?? 0) * a.quantity * costFx
    }

    return { totalCostTWD, totalSellTWD, totalRealizedPnL, activePositions, totalBalanceTWD, totalUnrealizedPnLTWD }
  }, [transactions, assets, accounts, exchangeRate, dateFrom, dateTo, filterCurrency, filterAccountId, filterMarket, filterAssetType, filterKeyword])

  // 持倉標的數：資產管理中所有非現金資產的數量
  const assetCount = useMemo(
    () => assets.filter((a) => a.market !== 'CASH' && a.assetType !== 'cash').length,
    [assets]
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
      <StatCard
        label="現金(TWD)"
        value={formatCurrency(stats.totalBalanceTWD, 'TWD')}
        icon={<Wallet className="w-4 h-4" />}
      />
      <StatCard
        label="持倉標的數"
        value={`${assetCount} 檔`}
        icon={<Package className="w-4 h-4" />}
      />
            <StatCard
        label="未實現損益 (TWD)"
        value={formatCurrency(stats.totalUnrealizedPnLTWD, 'TWD')}
        colorClass={stats.totalUnrealizedPnLTWD > 0 ? 'text-red-500' : stats.totalUnrealizedPnLTWD < 0 ? 'text-green-600' : undefined}
        icon={<BarChart2 className="w-4 h-4" />}
      />
      
      <StatCard
        label="總投入金額 (TWD)"
        value={formatCurrency(stats.totalCostTWD, 'TWD')}
        subValue="剩餘持倉成本基礎"
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
        colorClass={stats.totalRealizedPnL > 0 ? 'text-red-500' : stats.totalRealizedPnL < 0 ? 'text-green-600' : undefined}
        icon={<Activity className="w-4 h-4" />}
      />
    </div>
  )
}
