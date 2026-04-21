import {
  Currency,
  AssetType,
  Market,
  AccountType,
  CashFlowType,
  InvestmentTxType,
} from '@/lib/constants'

// ============================================================
// 基礎實體
// ============================================================

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

// ============================================================
// 帳戶
// ============================================================

export interface Account extends BaseEntity {
  name: string
  type: AccountType
  currency: Currency
  note?: string
}

// ============================================================
// 資產（投資標的）
// ============================================================

export interface Asset extends BaseEntity {
  name: string
  ticker: string
  assetType: AssetType
  market: Market
  currency: Currency
  note?: string
}

// ============================================================
// 投資交易
// ============================================================

export interface InvestmentTransaction extends BaseEntity {
  date: string
  assetId: string
  accountId: string
  txType: InvestmentTxType
  quantity: number
  price: number
  currency: Currency
  fxRateToBase: number
  fee: number
  tax: number
  note?: string
}

// ============================================================
// 收支記錄
// ============================================================

export interface IncomeExpenseRecord extends BaseEntity {
  date: string
  type: CashFlowType
  categoryId: string
  amount: number
  currency: Currency
  fxRateToBase: number
  note?: string
}

// ============================================================
// 月支出計畫
// ============================================================

export interface MonthlyExpensePlan extends BaseEntity {
  yearMonth: string // "YYYY-MM"
  categoryId: string
  plannedAmount: number
  currency: Currency
  note?: string
}

// ============================================================
// 收支分類
// ============================================================

export interface Category extends BaseEntity {
  name: string
  type: CashFlowType
}

// ============================================================
// 再平衡目標
// ============================================================

export interface RebalanceTarget extends BaseEntity {
  label: string
  targetKey: string // assetType or currency
  targetType: 'assetType' | 'currency'
  targetPercent: number  // 0-1
  tolerancePercent: number // 0-1
}

// ============================================================
// App Meta
// ============================================================

export interface AppMeta {
  version: string
  lastModified: string
  baseCurrency: Currency
  supportedCurrencies: Currency[]
}

// ============================================================
// 完整匯出結構
// ============================================================

export interface AppData {
  meta: AppMeta
  accounts: Account[]
  assets: Asset[]
  investmentTransactions: InvestmentTransaction[]
  incomeExpenseRecords: IncomeExpenseRecord[]
  monthlyExpensePlans: MonthlyExpensePlan[]
  categories: Category[]
  rebalanceTargets: RebalanceTarget[]
}

// ============================================================
// 計算結果型別（不儲存，動態計算）
// ============================================================

export interface HoldingStats {
  assetId: string
  quantity: number
  avgCost: number
  totalCost: number
  realizedPnL: number
}

export interface AllocationItem {
  key: string
  label: string
  currentAmountTWD: number
  currentPercent: number
  targetPercent: number
  tolerancePercent: number
  targetAmountTWD: number
  diffAmountTWD: number
  isWithinTolerance: boolean
}

export interface MonthlySummary {
  yearMonth: string
  totalIncome: number
  totalExpense: number
  totalPlannedExpense: number
  balance: number
  savingsRate: number
}
