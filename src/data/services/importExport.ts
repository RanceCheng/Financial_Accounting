import { AppData } from '@/data/types'
import { AppDataSchema } from '@/data/schemas'
import { db } from '@/data/db'
import { APP_VERSION, BASE_CURRENCY, CURRENCIES } from '@/lib/constants'

// ============================================================
// 資料完整性驗證
// ============================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateIntegrity(data: AppData): ValidationResult {
  const errors: string[] = []
  const assetIds = new Set(data.assets.map((a) => a.id))
  const accountIds = new Set(data.accounts.map((a) => a.id))
  const categoryIds = new Set(data.categories.map((c) => c.id))

  for (const tx of data.investmentTransactions) {
    if (!assetIds.has(tx.assetId)) {
      errors.push(`交易 ${tx.id} 引用了不存在的資產 ${tx.assetId}`)
    }
    if (!accountIds.has(tx.accountId)) {
      errors.push(`交易 ${tx.id} 引用了不存在的帳戶 ${tx.accountId}`)
    }
  }

  for (const rec of data.incomeExpenseRecords) {
    if (!categoryIds.has(rec.categoryId)) {
      errors.push(`收支記錄 ${rec.id} 引用了不存在的分類 ${rec.categoryId}`)
    }
  }

  for (const plan of data.monthlyExpensePlans) {
    if (!categoryIds.has(plan.categoryId)) {
      errors.push(`月支出計畫 ${plan.id} 引用了不存在的分類 ${plan.categoryId}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ============================================================
// 匯出 JSON
// ============================================================

export async function exportAppData(): Promise<AppData> {
  const [accounts, assets, investmentTransactions, incomeExpenseRecords, monthlyExpensePlans, categories, rebalanceTargets] =
    await Promise.all([
      db.accounts.toArray(),
      db.assets.toArray(),
      db.investmentTransactions.toArray(),
      db.incomeExpenseRecords.toArray(),
      db.monthlyExpensePlans.toArray(),
      db.categories.toArray(),
      db.rebalanceTargets.toArray(),
    ])

  return {
    meta: {
      version: APP_VERSION,
      lastModified: new Date().toISOString(),
      baseCurrency: BASE_CURRENCY,
      supportedCurrencies: [...CURRENCIES],
    },
    accounts,
    assets,
    investmentTransactions,
    incomeExpenseRecords,
    monthlyExpensePlans,
    categories,
    rebalanceTargets,
  }
}

export function downloadJson(data: AppData): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financial_accounting_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============================================================
// 匯入 JSON
// ============================================================

export async function importAppData(jsonStr: string): Promise<ValidationResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { valid: false, errors: ['JSON 格式錯誤，無法解析'] }
  }

  // Schema validation
  const schemaResult = AppDataSchema.safeParse(parsed)
  if (!schemaResult.success) {
    const errors = schemaResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    return { valid: false, errors }
  }

  const data = schemaResult.data as AppData

  // Integrity validation
  const integrityResult = validateIntegrity(data)
  if (!integrityResult.valid) {
    return integrityResult
  }

  // Write to IndexedDB
  await db.transaction('rw', [
    db.accounts,
    db.assets,
    db.investmentTransactions,
    db.incomeExpenseRecords,
    db.monthlyExpensePlans,
    db.categories,
    db.rebalanceTargets,
  ], async () => {
    await db.accounts.clear()
    await db.assets.clear()
    await db.investmentTransactions.clear()
    await db.incomeExpenseRecords.clear()
    await db.monthlyExpensePlans.clear()
    await db.categories.clear()
    await db.rebalanceTargets.clear()

    await db.accounts.bulkAdd(data.accounts)
    await db.assets.bulkAdd(data.assets)
    await db.investmentTransactions.bulkAdd(data.investmentTransactions)
    await db.incomeExpenseRecords.bulkAdd(data.incomeExpenseRecords)
    await db.monthlyExpensePlans.bulkAdd(data.monthlyExpensePlans)
    await db.categories.bulkAdd(data.categories)
    await db.rebalanceTargets.bulkAdd(data.rebalanceTargets)
  })

  return { valid: true, errors: [] }
}
