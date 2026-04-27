import { v4 as uuidv4 } from 'uuid'
import { db } from '@/data/db'
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
import {
  AccountInput,
  AssetInput,
  InvestmentTransactionInput,
  IncomeExpenseRecordInput,
  MonthlyExpensePlanInput,
  CategoryInput,
  RebalanceTargetInput,
} from '@/data/schemas'

function now() {
  return new Date().toISOString()
}

function newEntity<T>(input: T): T & { id: string; createdAt: string; updatedAt: string } {
  return { ...input as object, id: uuidv4(), createdAt: now(), updatedAt: now() } as T & { id: string; createdAt: string; updatedAt: string }
}

// ============================================================
// Account Repository
// ============================================================

export const accountRepo = {
  getAll: () => db.accounts.toArray(),
  getById: (id: string) => db.accounts.get(id),
  add: async (input: AccountInput): Promise<Account> => {
    const entity = newEntity(input) as Account
    await db.accounts.add(entity)
    return entity
  },
  update: async (id: string, input: Partial<AccountInput>): Promise<Account> => {
    await db.accounts.update(id, { ...(input as Partial<Account>), updatedAt: now() })
    return db.accounts.get(id) as Promise<Account>
  },
  delete: async (id: string) => {
    await db.accounts.delete(id)
  },
}

// ============================================================
// Asset Repository
// ============================================================

export const assetRepo = {
  getAll: () => db.assets.toArray(),
  getById: (id: string) => db.assets.get(id),
  add: async (input: AssetInput): Promise<Asset> => {
    const entity = newEntity(input) as Asset
    await db.assets.add(entity)
    return entity
  },
  update: async (id: string, input: Partial<AssetInput>): Promise<Asset> => {
    await db.assets.update(id, { ...(input as Partial<Asset>), updatedAt: now() })
    return db.assets.get(id) as Promise<Asset>
  },
  delete: async (id: string) => {
    await db.assets.delete(id)
  },
}

// ============================================================
// InvestmentTransaction Repository
// ============================================================

export const investmentTxRepo = {
  getAll: () => db.investmentTransactions.toArray(),
  getById: (id: string) => db.investmentTransactions.get(id),
  add: async (input: InvestmentTransactionInput): Promise<InvestmentTransaction> => {
    const entity = newEntity(input) as InvestmentTransaction
    await db.investmentTransactions.add(entity)
    return entity
  },
  update: async (id: string, input: Partial<InvestmentTransactionInput>): Promise<InvestmentTransaction> => {
    await db.investmentTransactions.update(id, { ...(input as Partial<InvestmentTransaction>), updatedAt: now() })
    return db.investmentTransactions.get(id) as Promise<InvestmentTransaction>
  },
  delete: async (id: string) => {
    await db.investmentTransactions.delete(id)
  },
}

// ============================================================
// IncomeExpenseRecord Repository
// ============================================================

export const incomeExpenseRepo = {
  getAll: () => db.incomeExpenseRecords.toArray(),
  getById: (id: string) => db.incomeExpenseRecords.get(id),
  add: async (input: IncomeExpenseRecordInput): Promise<IncomeExpenseRecord> => {
    const entity = newEntity(input) as IncomeExpenseRecord
    await db.incomeExpenseRecords.add(entity)
    return entity
  },
  update: async (id: string, input: Partial<IncomeExpenseRecordInput>): Promise<IncomeExpenseRecord> => {
    await db.incomeExpenseRecords.update(id, { ...(input as Partial<IncomeExpenseRecord>), updatedAt: now() })
    return db.incomeExpenseRecords.get(id) as Promise<IncomeExpenseRecord>
  },
  delete: async (id: string) => {
    await db.incomeExpenseRecords.delete(id)
  },
}

// ============================================================
// MonthlyExpensePlan Repository
// ============================================================

export const monthlyPlanRepo = {
  getAll: () => db.monthlyExpensePlans.toArray(),
  getById: (id: string) => db.monthlyExpensePlans.get(id),
  getByMonth: (yearMonth: string) =>
    db.monthlyExpensePlans.where('yearMonth').equals(yearMonth).toArray(),
  add: async (input: MonthlyExpensePlanInput): Promise<MonthlyExpensePlan> => {
    const entity = newEntity(input) as MonthlyExpensePlan
    await db.monthlyExpensePlans.add(entity)
    return entity
  },
  update: async (id: string, input: Partial<MonthlyExpensePlanInput>): Promise<MonthlyExpensePlan> => {
    await db.monthlyExpensePlans.update(id, { ...(input as Partial<MonthlyExpensePlan>), updatedAt: now() })
    return db.monthlyExpensePlans.get(id) as Promise<MonthlyExpensePlan>
  },
  delete: async (id: string) => {
    await db.monthlyExpensePlans.delete(id)
  },
}

// ============================================================
// Category Repository
// ============================================================

export const categoryRepo = {
  getAll: () => db.categories.toArray(),
  getById: (id: string) => db.categories.get(id),
  add: async (input: CategoryInput): Promise<Category> => {
    const entity = newEntity(input) as Category
    await db.categories.add(entity)
    return entity
  },
  update: async (id: string, input: Partial<CategoryInput>): Promise<Category> => {
    await db.categories.update(id, { ...(input as Partial<Category>), updatedAt: now() })
    return db.categories.get(id) as Promise<Category>
  },
  delete: async (id: string) => {
    await db.categories.delete(id)
  },
}

// ============================================================
// RebalanceTarget Repository
// ============================================================

export const rebalanceTargetRepo = {
  getAll: () => db.rebalanceTargets.toArray(),
  getById: (id: string) => db.rebalanceTargets.get(id),
  add: async (input: RebalanceTargetInput): Promise<RebalanceTarget> => {
    const entity = newEntity(input) as RebalanceTarget
    await db.rebalanceTargets.add(entity)
    return entity
  },
  update: async (id: string, input: Partial<RebalanceTargetInput>): Promise<RebalanceTarget> => {
    await db.rebalanceTargets.update(id, { ...(input as Partial<RebalanceTarget>), updatedAt: now() })
    return db.rebalanceTargets.get(id) as Promise<RebalanceTarget>
  },
  delete: async (id: string) => {
    await db.rebalanceTargets.delete(id)
  },
}

// ============================================================
// ExchangeRate Repository
// ============================================================

export const exchangeRateRepo = {
  get: (): Promise<ExchangeRate | undefined> => db.exchangeRates.get('current'),
  save: async (rate: Omit<ExchangeRate, 'id'>): Promise<void> => {
    await db.exchangeRates.put({ id: 'current', ...rate })
  },
}

// ============================================================
// AccountTransfer Repository
// ============================================================

export const accountTransferRepo = {
  getAll: () => db.accountTransfers.toArray(),
  add: async (input: Omit<AccountTransfer, 'id' | 'createdAt' | 'updatedAt'>): Promise<AccountTransfer> => {
    const entity = newEntity(input) as AccountTransfer
    await db.accountTransfers.add(entity)
    return entity
  },
  delete: async (id: string) => {
    await db.accountTransfers.delete(id)
  },
}
