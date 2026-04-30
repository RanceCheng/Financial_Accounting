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
  balance: number
  note?: string
}

// ============================================================
// 資產（投資標的）
// ============================================================

export interface AssetLot {
  id: string
  name: string
  buyPrice?: number
  fxRateToBase?: number  // 買入時匯率（1 外幣 = X TWD）；TWD 預設 1
  buyDate: string
  quantity?: number
}

export interface Asset extends BaseEntity {
  name: string
  ticker: string
  assetType: AssetType
  market: Market
  currency: Currency
  quantity?: number
  buyPrice?: number
  fxRateToBase?: number  // 加權平均成本匯率（1 外幣 = X TWD），由批次自動計算
  currentPrice?: number
  note?: string
  lots?: AssetLot[]
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
  accountId?: string
  amount: number
  currency: Currency
  fxRateToBase: number
  note?: string
  linkedTicker?: string
}

// ============================================================
// 月計畫（收入 / 支出）
// ============================================================

export interface MonthlyExpensePlan extends BaseEntity {
  type?: CashFlowType  // 'income' | 'expense'（舊資料無此欄，視為 'expense'）
  categoryId: string
  plannedAmount: number
  currency: Currency
  note?: string
  linkedTicker?: string
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
// 帳戶轉帳
// ============================================================

export interface AccountTransfer extends BaseEntity {
  date: string
  fromAccountId: string
  toAccountId: string
  fromCurrency: Currency
  toCurrency: Currency
  fromAmount: number        // 轉出金額
  toAmount: number          // 轉入金額
  exchangeRate: number      // 1 轉出幣別 = X 轉入幣別
  fee: number               // 手續費（以轉出幣別計）
  fromBalanceAfter: number  // 轉出帳戶轉後餘額
  toBalanceAfter: number    // 轉入帳戶轉後餘額
  note?: string
}

// ============================================================
// 匯率（快取單筆，id 固定為 'current'）
// ============================================================

export interface ExchangeRate {
  id: string        // 'current'
  updatedAt: string // 最後更新時間（ISO8601）
  usdRate: number   // 1 USD = X TWD
  jpyRate: number   // 1 JPY = X TWD
  cnyRate: number   // 1 CNY = X TWD
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
  accountTransfers?: AccountTransfer[]
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
