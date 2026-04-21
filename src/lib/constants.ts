// ============================================================
// 固定業務常數
// ============================================================

export const BASE_CURRENCY = 'TWD' as const

export const CURRENCIES = ['TWD', 'USD', 'JPY', 'CNY'] as const
export type Currency = (typeof CURRENCIES)[number]

export const ASSET_TYPES = ['tw_stock', 'us_stock', 'jp_stock', 'cash', 'fund'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const MARKETS = ['TW', 'US', 'JP', 'CN', 'CASH'] as const
export type Market = (typeof MARKETS)[number]

export const ACCOUNT_TYPES = ['brokerage', 'bank', 'cash'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const CASH_FLOW_TYPES = ['income', 'expense'] as const
export type CashFlowType = (typeof CASH_FLOW_TYPES)[number]

export const INVESTMENT_TX_TYPES = ['buy', 'sell', 'dividend', 'fee', 'tax', 'deposit', 'withdrawal'] as const
export type InvestmentTxType = (typeof INVESTMENT_TX_TYPES)[number]

// ============================================================
// 顯示標籤
// ============================================================

export const CURRENCY_LABELS: Record<Currency, string> = {
  TWD: 'TWD 新台幣',
  USD: 'USD 美元',
  JPY: 'JPY 日圓',
  CNY: 'CNY 人民幣',
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  tw_stock: '台股',
  us_stock: '美股',
  jp_stock: '日股',
  cash: '現金',
  fund: '基金',
}

export const MARKET_LABELS: Record<Market, string> = {
  TW: '台灣',
  US: '美國',
  JP: '日本',
  CN: '中國',
  CASH: '現金',
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  brokerage: '券商',
  bank: '銀行',
  cash: '現金帳戶',
}

export const CASH_FLOW_TYPE_LABELS: Record<CashFlowType, string> = {
  income: '收入',
  expense: '支出',
}

export const INVESTMENT_TX_TYPE_LABELS: Record<InvestmentTxType, string> = {
  buy: '買入',
  sell: '賣出',
  dividend: '配息',
  fee: '手續費',
  tax: '稅費',
  deposit: '入金',
  withdrawal: '出金',
}

// ============================================================
// 預設分類
// ============================================================

export const DEFAULT_INCOME_CATEGORIES = [
  { name: '薪資', type: 'income' as CashFlowType },
  { name: '獎金', type: 'income' as CashFlowType },
  { name: '股利', type: 'income' as CashFlowType },
  { name: '利息', type: 'income' as CashFlowType },
  { name: '其他收入', type: 'income' as CashFlowType },
]

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '房租', type: 'expense' as CashFlowType },
  { name: '餐飲', type: 'expense' as CashFlowType },
  { name: '交通', type: 'expense' as CashFlowType },
  { name: '水電瓦斯', type: 'expense' as CashFlowType },
  { name: '娛樂', type: 'expense' as CashFlowType },
  { name: '保險', type: 'expense' as CashFlowType },
  { name: '醫療', type: 'expense' as CashFlowType },
  { name: '購物', type: 'expense' as CashFlowType },
  { name: '旅遊', type: 'expense' as CashFlowType },
  { name: '金融投資', type: 'expense' as CashFlowType },
  { name: '其他支出', type: 'expense' as CashFlowType },
]

export const APP_VERSION = '1.0.0'
