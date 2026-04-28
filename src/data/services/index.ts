import {
  InvestmentTransaction,
  Asset,
  HoldingStats,
  AllocationItem,
  Account,
  RebalanceTarget,
  MonthlySummary,
  IncomeExpenseRecord,
  MonthlyExpensePlan,
  Category,
  ExchangeRate,
} from '@/data/types'
import { ASSET_TYPE_LABELS, CURRENCY_LABELS, AssetType, Currency } from '@/lib/constants'
import { getMonthKey } from '@/lib/formatters'

// ============================================================
// 投資持倉計算
// ============================================================

export function calcHoldingStats(
  transactions: InvestmentTransaction[],
  assetId: string
): HoldingStats {
  const txs = transactions.filter((t) => t.assetId === assetId)
  let quantity = 0
  let totalCost = 0
  let realizedPnL = 0

  for (const tx of txs) {
    const netAmt = tx.quantity * tx.price * tx.fxRateToBase
    if (tx.txType === 'buy' || tx.txType === 'deposit') {
      quantity += tx.quantity
      totalCost += netAmt + (tx.fee + tx.tax) * tx.fxRateToBase
    } else if (tx.txType === 'sell' || tx.txType === 'withdrawal') {
      const avgCost = quantity > 0 ? totalCost / quantity : 0
      const costOfSold = avgCost * tx.quantity
      realizedPnL += netAmt - (tx.fee + tx.tax) * tx.fxRateToBase - costOfSold
      quantity = Math.max(0, quantity - tx.quantity)
      totalCost = Math.max(0, totalCost - costOfSold)
    } else if (tx.txType === 'dividend') {
      realizedPnL += netAmt - (tx.fee + tx.tax) * tx.fxRateToBase
    } else if (tx.txType === 'fee' || tx.txType === 'tax') {
      totalCost += (tx.fee + tx.tax) * tx.fxRateToBase
    }
  }

  const avgCost = quantity > 0 ? totalCost / quantity : 0
  return { assetId, quantity, avgCost, totalCost, realizedPnL }
}

export function calcAllHoldings(
  transactions: InvestmentTransaction[],
  assets: Asset[]
): HoldingStats[] {
  return assets.map((a) => calcHoldingStats(transactions, a.id))
}

// ============================================================
// 資產再平衡計算
// ============================================================

export function calcTotalAssetTWD(
  transactions: InvestmentTransaction[],
  assets: Asset[],
  accounts: Account[],
  cashBalances: Record<string, number> = {}
): number {
  let total = 0
  for (const asset of assets) {
    const stats = calcHoldingStats(transactions, asset.id)
    total += stats.totalCost // using cost basis as TWD value
  }
  // add cash accounts
  for (const acc of accounts) {
    if (acc.type === 'cash' || acc.type === 'bank') {
      const balance = cashBalances[acc.id] ?? 0
      total += balance * (acc.currency === 'TWD' ? 1 : 1) // simplified
    }
  }
  return total
}

export function calcAllocationByAssetType(
  _transactions: InvestmentTransaction[],
  assets: Asset[],
  rebalanceTargets: RebalanceTarget[],
  exchangeRate?: ExchangeRate
): AllocationItem[] {
  const amountByType: Record<string, number> = {}

  for (const asset of assets) {
    const qty = asset.quantity ?? 0
    if (qty <= 0) continue
    const costFx = (asset.fxRateToBase != null && asset.fxRateToBase > 0)
      ? asset.fxRateToBase
      : getExFx(exchangeRate, asset.currency)
    const cost = (asset.buyPrice ?? 0) * qty * costFx
    amountByType[asset.assetType] = (amountByType[asset.assetType] ?? 0) + cost
  }

  const totalTWD = Object.values(amountByType).reduce((s, v) => s + v, 0) || 1

  const results: AllocationItem[] = Object.entries(amountByType).map(([key, amt]) => {
    const target = rebalanceTargets.find(
      (t) => t.targetType === 'assetType' && t.targetKey === key
    )
    const targetPercent = target?.targetPercent ?? 0
    const tolerancePercent = target?.tolerancePercent ?? 0
    const currentPercent = amt / totalTWD
    const targetAmountTWD = targetPercent * totalTWD
    const diffAmountTWD = targetAmountTWD - amt
    const isWithinTolerance = Math.abs(currentPercent - targetPercent) <= tolerancePercent

    return {
      key,
      label: ASSET_TYPE_LABELS[key as AssetType] ?? key,
      currentAmountTWD: amt,
      currentPercent,
      targetPercent,
      tolerancePercent,
      targetAmountTWD,
      diffAmountTWD,
      isWithinTolerance,
    }
  })

  return results
}

export function calcAllocationByCurrency(
  _transactions: InvestmentTransaction[],
  assets: Asset[],
  rebalanceTargets: RebalanceTarget[],
  exchangeRate?: ExchangeRate
): AllocationItem[] {
  const amountByCurrency: Record<string, number> = {}

  for (const asset of assets) {
    const qty = asset.quantity ?? 0
    if (qty <= 0) continue
    const costFx = (asset.fxRateToBase != null && asset.fxRateToBase > 0)
      ? asset.fxRateToBase
      : getExFx(exchangeRate, asset.currency)
    const cost = (asset.buyPrice ?? 0) * qty * costFx
    amountByCurrency[asset.currency] = (amountByCurrency[asset.currency] ?? 0) + cost
  }

  const totalTWD = Object.values(amountByCurrency).reduce((s, v) => s + v, 0) || 1

  return Object.entries(amountByCurrency).map(([key, amt]) => {
    const target = rebalanceTargets.find(
      (t) => t.targetType === 'currency' && t.targetKey === key
    )
    const targetPercent = target?.targetPercent ?? 0
    const tolerancePercent = target?.tolerancePercent ?? 0
    const currentPercent = amt / totalTWD
    const targetAmountTWD = targetPercent * totalTWD
    const diffAmountTWD = targetAmountTWD - amt
    const isWithinTolerance = Math.abs(currentPercent - targetPercent) <= tolerancePercent

    return {
      key,
      label: CURRENCY_LABELS[key as Currency] ?? key,
      currentAmountTWD: amt,
      currentPercent,
      targetPercent,
      tolerancePercent,
      targetAmountTWD,
      diffAmountTWD,
      isWithinTolerance,
    }
  })
}

// 市値版（使用 currentPrice * quantity 換算 TWD）
function getExFx(exchangeRate: ExchangeRate | undefined, currency: string): number {
  if (!exchangeRate || currency === 'TWD') return 1
  if (currency === 'USD' && exchangeRate.usdRate > 0) return exchangeRate.usdRate
  if (currency === 'JPY' && exchangeRate.jpyRate > 0) return exchangeRate.jpyRate
  if (currency === 'CNY' && exchangeRate.cnyRate > 0) return exchangeRate.cnyRate
  return 1
}

export function calcAllocationByAssetTypeMarketValue(
  assets: Asset[],
  exchangeRate: ExchangeRate | undefined,
  rebalanceTargets: RebalanceTarget[],
  accounts: Account[] = []
): AllocationItem[] {
  const amountByType: Record<string, number> = {}
  for (const asset of assets) {
    const qty = asset.quantity ?? 0
    const price = asset.currentPrice ?? 0
    if (qty <= 0 || price <= 0) continue
    const mv = price * qty * getExFx(exchangeRate, asset.currency)
    amountByType[asset.assetType] = (amountByType[asset.assetType] ?? 0) + mv
  }
  // 加入帳戶現金（含負値，統一換算 TWD 後加入 cash bucket）
  for (const a of accounts) {
    const bal = a.balance ?? 0
    amountByType['cash'] = (amountByType['cash'] ?? 0) + bal * getExFx(exchangeRate, a.currency)
  }
  const totalTWD = Object.values(amountByType).reduce((s, v) => s + v, 0) || 1
  return Object.entries(amountByType).map(([key, amt]) => {
    const target = rebalanceTargets.find(t => t.targetType === 'assetType' && t.targetKey === key)
    const targetPercent = target?.targetPercent ?? 0
    const tolerancePercent = target?.tolerancePercent ?? 0
    const currentPercent = amt / totalTWD
    const targetAmountTWD = targetPercent * totalTWD
    const diffAmountTWD = targetAmountTWD - amt
    const isWithinTolerance = Math.abs(currentPercent - targetPercent) <= tolerancePercent
    return { key, label: ASSET_TYPE_LABELS[key as AssetType] ?? key, currentAmountTWD: amt, currentPercent, targetPercent, tolerancePercent, targetAmountTWD, diffAmountTWD, isWithinTolerance }
  })
}

export function calcAllocationByCurrencyMarketValue(
  assets: Asset[],
  exchangeRate: ExchangeRate | undefined,
  rebalanceTargets: RebalanceTarget[],
  accounts: Account[] = []
): AllocationItem[] {
  const amountByCurrency: Record<string, number> = {}
  for (const asset of assets) {
    const qty = asset.quantity ?? 0
    const price = asset.currentPrice ?? 0
    if (qty <= 0 || price <= 0) continue
    const mv = price * qty * getExFx(exchangeRate, asset.currency)
    amountByCurrency[asset.currency] = (amountByCurrency[asset.currency] ?? 0) + mv
  }
  // 加入帳戶現金：按帳戶原始幣別分配（含負値）
  for (const a of accounts) {
    const bal = a.balance ?? 0
    amountByCurrency[a.currency] = (amountByCurrency[a.currency] ?? 0) + bal * getExFx(exchangeRate, a.currency)
  }
  const totalTWD = Object.values(amountByCurrency).reduce((s, v) => s + v, 0) || 1
  return Object.entries(amountByCurrency).map(([key, amt]) => {
    const target = rebalanceTargets.find(t => t.targetType === 'currency' && t.targetKey === key)
    const targetPercent = target?.targetPercent ?? 0
    const tolerancePercent = target?.tolerancePercent ?? 0
    const currentPercent = amt / totalTWD
    const targetAmountTWD = targetPercent * totalTWD
    const diffAmountTWD = targetAmountTWD - amt
    const isWithinTolerance = Math.abs(currentPercent - targetPercent) <= tolerancePercent
    return { key, label: CURRENCY_LABELS[key as Currency] ?? key, currentAmountTWD: amt, currentPercent, targetPercent, tolerancePercent, targetAmountTWD, diffAmountTWD, isWithinTolerance }
  })
}

// ============================================================
// 月收支計算
// ============================================================

export function calcMonthlySummaries(
  records: IncomeExpenseRecord[],
  plans: MonthlyExpensePlan[]
): MonthlySummary[] {
  const monthMap: Map<string, { income: number; expense: number }> = new Map()

  for (const r of records) {
    const key = getMonthKey(r.date)
    const amtTWD = r.amount * r.fxRateToBase
    const entry = monthMap.get(key) ?? { income: 0, expense: 0 }
    if (r.type === 'income') {
      entry.income += amtTWD
    } else {
      entry.expense += amtTWD
    }
    monthMap.set(key, entry)
  }

  // 固定計畫：每個有紀錄的月份都套用相同的計畫總額
  const totalPlannedExpense = plans.reduce((sum, p) => sum + p.plannedAmount, 0)

  const summaries: MonthlySummary[] = []
  for (const [yearMonth, { income, expense }] of monthMap) {
    const balance = income - expense
    const savingsRate = income > 0 ? balance / income : 0
    summaries.push({ yearMonth, totalIncome: income, totalExpense: expense, totalPlannedExpense, balance, savingsRate })
  }

  return summaries.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}

export function calcExpenseByCategory(
  records: IncomeExpenseRecord[],
  categories: Category[],
  yearMonth?: string
): Array<{ categoryId: string; categoryName: string; amount: number }> {
  const filtered = yearMonth
    ? records.filter((r) => r.type === 'expense' && getMonthKey(r.date) === yearMonth)
    : records.filter((r) => r.type === 'expense')

  const catMap = new Map(categories.map((c) => [c.id, c.name]))
  const amountMap: Map<string, number> = new Map()

  for (const r of filtered) {
    const cur = amountMap.get(r.categoryId) ?? 0
    amountMap.set(r.categoryId, cur + r.amount * r.fxRateToBase)
  }

  return Array.from(amountMap.entries()).map(([categoryId, amount]) => ({
    categoryId,
    categoryName: catMap.get(categoryId) ?? '未知分類',
    amount,
  }))
}
