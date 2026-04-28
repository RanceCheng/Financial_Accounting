import { z } from 'zod'
import { CURRENCIES, ASSET_TYPES, MARKETS, ACCOUNT_TYPES, CASH_FLOW_TYPES, INVESTMENT_TX_TYPES } from '@/lib/constants'

const currencies = CURRENCIES as unknown as [string, ...string[]]
const assetTypes = ASSET_TYPES as unknown as [string, ...string[]]
const markets = MARKETS as unknown as [string, ...string[]]
const accountTypes = ACCOUNT_TYPES as unknown as [string, ...string[]]
const cashFlowTypes = CASH_FLOW_TYPES as unknown as [string, ...string[]]
const investmentTxTypes = INVESTMENT_TX_TYPES as unknown as [string, ...string[]]

const BaseEntitySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const AccountSchema = BaseEntitySchema.extend({
  name: z.string().min(1, '帳戶名稱必填'),
  type: z.enum(accountTypes as [string, ...string[]]),
  currency: z.enum(currencies as [string, ...string[]]),
  balance: z.number().min(0, '現有資金不可為負數'),
  note: z.string().optional(),
})

const AssetLotSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  buyPrice: z.number().min(0).optional(),
  fxRateToBase: z.number().positive().optional(),
  buyDate: z.string(),
  quantity: z.number().min(0).optional(),
})

export const AssetSchema = BaseEntitySchema.extend({
  name: z.string().min(1, '資產名稱必填'),
  ticker: z.string(),
  assetType: z.enum(assetTypes as [string, ...string[]]),
  market: z.enum(markets as [string, ...string[]]),
  currency: z.enum(currencies as [string, ...string[]]),
  quantity: z.number().min(0).optional(),
  buyPrice: z.number().min(0).optional(),
  fxRateToBase: z.number().positive().optional(),
  currentPrice: z.number().min(0).optional(),
  note: z.string().optional(),
  lots: z.array(AssetLotSchema).optional(),
})

export const InvestmentTransactionSchema = BaseEntitySchema.extend({
  date: z.string().min(1, '日期必填'),
  assetId: z.string().min(1),
  accountId: z.string().min(1),
  txType: z.enum(investmentTxTypes as [string, ...string[]]),
  quantity: z.number().min(0, '數量不可為負數'),
  price: z.number().min(0, '單價不可為負數'),
  currency: z.enum(currencies as [string, ...string[]]),
  fxRateToBase: z.number().positive('匯率必須大於 0'),
  fee: z.number().min(0, '手續費不可為負數'),
  tax: z.number().min(0, '稅費不可為負數'),
  note: z.string().optional(),
})

export const IncomeExpenseRecordSchema = BaseEntitySchema.extend({
  date: z.string().min(1, '日期必填'),
  type: z.enum(cashFlowTypes as [string, ...string[]]),
  categoryId: z.string().min(1),
  amount: z.number().min(0, '金額不可為負數'),
  currency: z.enum(currencies as [string, ...string[]]),
  fxRateToBase: z.number().positive('匯率必須大於 0'),
  note: z.string().optional(),
})

export const MonthlyExpensePlanSchema = BaseEntitySchema.extend({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, '格式必須為 YYYY-MM'),
  categoryId: z.string().min(1),
  plannedAmount: z.number().min(0, '計畫金額不可為負數'),
  currency: z.enum(currencies as [string, ...string[]]),
  note: z.string().optional(),
})

export const CategorySchema = BaseEntitySchema.extend({
  name: z.string().min(1, '分類名稱必填'),
  type: z.enum(cashFlowTypes as [string, ...string[]]),
})

export const RebalanceTargetSchema = BaseEntitySchema.extend({
  label: z.string().min(1),
  targetKey: z.string().min(1),
  targetType: z.enum(['assetType', 'currency']),
  targetPercent: z.number().min(0).max(1),
  tolerancePercent: z.number().min(0).max(1),
})

export const AppMetaSchema = z.object({
  version: z.string(),
  lastModified: z.string().datetime(),
  baseCurrency: z.enum(currencies as [string, ...string[]]),
  supportedCurrencies: z.array(z.enum(currencies as [string, ...string[]])),
})

export const AppDataSchema = z.object({
  meta: AppMetaSchema,
  accounts: z.array(AccountSchema),
  assets: z.array(AssetSchema),
  investmentTransactions: z.array(InvestmentTransactionSchema),
  incomeExpenseRecords: z.array(IncomeExpenseRecordSchema),
  monthlyExpensePlans: z.array(MonthlyExpensePlanSchema),
  categories: z.array(CategorySchema),
  rebalanceTargets: z.array(RebalanceTargetSchema),
})

export type AccountInput = Omit<z.infer<typeof AccountSchema>, 'id' | 'createdAt' | 'updatedAt'>
export type AssetInput = Omit<z.infer<typeof AssetSchema>, 'id' | 'createdAt' | 'updatedAt'>
export type InvestmentTransactionInput = Omit<z.infer<typeof InvestmentTransactionSchema>, 'id' | 'createdAt' | 'updatedAt'>
export type IncomeExpenseRecordInput = Omit<z.infer<typeof IncomeExpenseRecordSchema>, 'id' | 'createdAt' | 'updatedAt'>
export type MonthlyExpensePlanInput = Omit<z.infer<typeof MonthlyExpensePlanSchema>, 'id' | 'createdAt' | 'updatedAt'>
export type CategoryInput = Omit<z.infer<typeof CategorySchema>, 'id' | 'createdAt' | 'updatedAt'>
export type RebalanceTargetInput = Omit<z.infer<typeof RebalanceTargetSchema>, 'id' | 'createdAt' | 'updatedAt'>
