import Dexie, { Table } from 'dexie'
import {
  Account,
  Asset,
  InvestmentTransaction,
  IncomeExpenseRecord,
  MonthlyExpensePlan,
  Category,
  RebalanceTarget,
  ExchangeRate,
  AccountTransfer,
} from '@/data/types'

export class FinancialDB extends Dexie {
  accounts!: Table<Account>
  assets!: Table<Asset>
  investmentTransactions!: Table<InvestmentTransaction>
  incomeExpenseRecords!: Table<IncomeExpenseRecord>
  monthlyExpensePlans!: Table<MonthlyExpensePlan>
  categories!: Table<Category>
  rebalanceTargets!: Table<RebalanceTarget>
  exchangeRates!: Table<ExchangeRate>
  accountTransfers!: Table<AccountTransfer>

  constructor() {
    super('FinancialAccountingDB')
    this.version(1).stores({
      accounts: 'id, type, currency, name',
      assets: 'id, assetType, market, currency, ticker, name',
      investmentTransactions: 'id, date, assetId, accountId, txType, currency',
      incomeExpenseRecords: 'id, date, type, categoryId, currency',
      monthlyExpensePlans: 'id, yearMonth, categoryId',
      categories: 'id, type, name',
      rebalanceTargets: 'id, targetType, targetKey',
    })
    this.version(2).stores({
      accounts: 'id, type, currency, name',
      assets: 'id, assetType, market, currency, ticker, name',
      investmentTransactions: 'id, date, assetId, accountId, txType, currency',
      incomeExpenseRecords: 'id, date, type, categoryId, currency',
      monthlyExpensePlans: 'id, yearMonth, categoryId',
      categories: 'id, type, name',
      rebalanceTargets: 'id, targetType, targetKey',
      exchangeRates: 'id',
    })
    this.version(3).stores({
      accounts: 'id, type, currency, name',
      assets: 'id, assetType, market, currency, ticker, name',
      investmentTransactions: 'id, date, assetId, accountId, txType, currency',
      incomeExpenseRecords: 'id, date, type, categoryId, currency',
      monthlyExpensePlans: 'id, yearMonth, categoryId',
      categories: 'id, type, name',
      rebalanceTargets: 'id, targetType, targetKey',
      exchangeRates: 'id',
      accountTransfers: 'id, date, fromAccountId, toAccountId',
    })
    // v4: 匯率儲存方向改為 "1 外幣 = X TWD"（舊格式為 "1 TWD = X 外幣"），遷移時將舊值取倒數
    this.version(4).stores({
      accounts: 'id, type, currency, name',
      assets: 'id, assetType, market, currency, ticker, name',
      investmentTransactions: 'id, date, assetId, accountId, txType, currency',
      incomeExpenseRecords: 'id, date, type, categoryId, currency',
      monthlyExpensePlans: 'id, yearMonth, categoryId',
      categories: 'id, type, name',
      rebalanceTargets: 'id, targetType, targetKey',
      exchangeRates: 'id',
      accountTransfers: 'id, date, fromAccountId, toAccountId',
    }).upgrade(tx => {
      return tx.table('exchangeRates').toCollection().modify((rate: { usdRate: number; jpyRate: number; cnyRate: number }) => {
        if (rate.usdRate > 0) rate.usdRate = parseFloat((1 / rate.usdRate).toFixed(4))
        if (rate.jpyRate > 0) rate.jpyRate = parseFloat((1 / rate.jpyRate).toFixed(4))
        if (rate.cnyRate > 0) rate.cnyRate = parseFloat((1 / rate.cnyRate).toFixed(4))
      })
    })
  }
}

export const db = new FinancialDB()
