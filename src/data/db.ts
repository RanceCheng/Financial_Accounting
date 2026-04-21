import Dexie, { Table } from 'dexie'
import {
  Account,
  Asset,
  InvestmentTransaction,
  IncomeExpenseRecord,
  MonthlyExpensePlan,
  Category,
  RebalanceTarget,
} from '@/data/types'

export class FinancialDB extends Dexie {
  accounts!: Table<Account>
  assets!: Table<Asset>
  investmentTransactions!: Table<InvestmentTransaction>
  incomeExpenseRecords!: Table<IncomeExpenseRecord>
  monthlyExpensePlans!: Table<MonthlyExpensePlan>
  categories!: Table<Category>
  rebalanceTargets!: Table<RebalanceTarget>

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
  }
}

export const db = new FinancialDB()
