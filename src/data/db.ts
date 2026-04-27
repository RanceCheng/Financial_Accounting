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
  }
}

export const db = new FinancialDB()
