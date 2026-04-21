import { v4 as uuidv4 } from 'uuid'
import { db } from '@/data/db'
import { APP_VERSION, DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from '@/lib/constants'

function now() {
  return new Date().toISOString()
}

export async function deduplicateCategories(): Promise<void> {
  const all = await db.categories.toArray()
  const seen = new Map<string, string>() // "name|type" -> id (first occurrence)
  const toDelete: string[] = []
  for (const cat of all) {
    const key = `${cat.name}|${cat.type}`
    if (seen.has(key)) {
      toDelete.push(cat.id)
    } else {
      seen.set(key, cat.id)
    }
  }
  if (toDelete.length > 0) {
    await db.categories.bulkDelete(toDelete)
  }
}

export async function seedIfEmpty(): Promise<void> {
  // 先清除重複分類
  await deduplicateCategories()

  const [accountCount] = await Promise.all([
    db.accounts.count(),
  ])

  // 逐項檢查是否已存在，只新增缺少的分類
  const defaultCategories = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES]
  const existingCategories = await db.categories.toArray()
  const existingKeys = new Set(existingCategories.map((c) => `${c.name}|${c.type}`))
  const missingCategories = defaultCategories.filter(
    (c) => !existingKeys.has(`${c.name}|${c.type}`)
  )
  if (missingCategories.length > 0) {
    await db.categories.bulkAdd(
      missingCategories.map((c) => ({
        id: uuidv4(),
        name: c.name,
        type: c.type,
        createdAt: now(),
        updatedAt: now(),
      }))
    )
  }

  if (accountCount === 0) {
    // Seed demo data
    const broker1Id = uuidv4()
    const bankId = uuidv4()
    const asset1Id = uuidv4()
    const asset2Id = uuidv4()
    const asset3Id = uuidv4()
    const categories = await db.categories.toArray()
    const salaryCategory = categories.find((c) => c.name === '薪資')
    const rentCategory = categories.find((c) => c.name === '房租')
    const diningCategory = categories.find((c) => c.name === '餐飲')

    await db.accounts.bulkAdd([
      {
        id: broker1Id,
        name: '富邦證券',
        type: 'brokerage',
        currency: 'TWD',
        note: '主要台股帳戶',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: bankId,
        name: '玉山銀行',
        type: 'bank',
        currency: 'TWD',
        createdAt: now(),
        updatedAt: now(),
      },
    ])

    await db.assets.bulkAdd([
      {
        id: asset1Id,
        name: '台積電',
        ticker: '2330',
        assetType: 'tw_stock',
        market: 'TW',
        currency: 'TWD',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: asset2Id,
        name: '蘋果公司',
        ticker: 'AAPL',
        assetType: 'us_stock',
        market: 'US',
        currency: 'USD',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: asset3Id,
        name: '元大台灣50',
        ticker: '0050',
        assetType: 'fund',
        market: 'TW',
        currency: 'TWD',
        createdAt: now(),
        updatedAt: now(),
      },
    ])

    await db.investmentTransactions.bulkAdd([
      {
        id: uuidv4(),
        date: '2024-01-15',
        assetId: asset1Id,
        accountId: broker1Id,
        txType: 'buy',
        quantity: 10,
        price: 600,
        currency: 'TWD',
        fxRateToBase: 1,
        fee: 43,
        tax: 0,
        note: '定期買入',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uuidv4(),
        date: '2024-03-20',
        assetId: asset2Id,
        accountId: broker1Id,
        txType: 'buy',
        quantity: 5,
        price: 175,
        currency: 'USD',
        fxRateToBase: 31.5,
        fee: 3,
        tax: 0,
        note: '美股買入',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uuidv4(),
        date: '2024-06-10',
        assetId: asset1Id,
        accountId: broker1Id,
        txType: 'buy',
        quantity: 5,
        price: 650,
        currency: 'TWD',
        fxRateToBase: 1,
        fee: 24,
        tax: 0,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uuidv4(),
        date: '2024-07-20',
        assetId: asset3Id,
        accountId: broker1Id,
        txType: 'buy',
        quantity: 100,
        price: 165,
        currency: 'TWD',
        fxRateToBase: 1,
        fee: 99,
        tax: 0,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uuidv4(),
        date: '2024-09-15',
        assetId: asset1Id,
        accountId: broker1Id,
        txType: 'sell',
        quantity: 5,
        price: 720,
        currency: 'TWD',
        fxRateToBase: 1,
        fee: 24,
        tax: 0,
        note: '獲利了結部分',
        createdAt: now(),
        updatedAt: now(),
      },
    ])

    if (salaryCategory && rentCategory && diningCategory) {
      await db.incomeExpenseRecords.bulkAdd([
        {
          id: uuidv4(),
          date: '2024-01-05',
          type: 'income',
          categoryId: salaryCategory.id,
          amount: 65000,
          currency: 'TWD',
          fxRateToBase: 1,
          note: '1月薪資',
          createdAt: now(),
          updatedAt: now(),
        },
        {
          id: uuidv4(),
          date: '2024-01-10',
          type: 'expense',
          categoryId: rentCategory.id,
          amount: 15000,
          currency: 'TWD',
          fxRateToBase: 1,
          note: '1月房租',
          createdAt: now(),
          updatedAt: now(),
        },
        {
          id: uuidv4(),
          date: '2024-01-20',
          type: 'expense',
          categoryId: diningCategory.id,
          amount: 8000,
          currency: 'TWD',
          fxRateToBase: 1,
          createdAt: now(),
          updatedAt: now(),
        },
        {
          id: uuidv4(),
          date: '2024-02-05',
          type: 'income',
          categoryId: salaryCategory.id,
          amount: 65000,
          currency: 'TWD',
          fxRateToBase: 1,
          note: '2月薪資',
          createdAt: now(),
          updatedAt: now(),
        },
        {
          id: uuidv4(),
          date: '2024-02-10',
          type: 'expense',
          categoryId: rentCategory.id,
          amount: 15000,
          currency: 'TWD',
          fxRateToBase: 1,
          createdAt: now(),
          updatedAt: now(),
        },
        {
          id: uuidv4(),
          date: '2024-03-05',
          type: 'income',
          categoryId: salaryCategory.id,
          amount: 65000,
          currency: 'TWD',
          fxRateToBase: 1,
          createdAt: now(),
          updatedAt: now(),
        },
      ])

      await db.monthlyExpensePlans.bulkAdd([
        {
          id: uuidv4(),
          yearMonth: '2024-01',
          categoryId: rentCategory.id,
          plannedAmount: 15000,
          currency: 'TWD',
          createdAt: now(),
          updatedAt: now(),
        },
        {
          id: uuidv4(),
          yearMonth: '2024-01',
          categoryId: diningCategory.id,
          plannedAmount: 10000,
          currency: 'TWD',
          createdAt: now(),
          updatedAt: now(),
        },
        {
          id: uuidv4(),
          yearMonth: '2024-02',
          categoryId: rentCategory.id,
          plannedAmount: 15000,
          currency: 'TWD',
          createdAt: now(),
          updatedAt: now(),
        },
      ])
    }

    await db.rebalanceTargets.bulkAdd([
      {
        id: uuidv4(),
        label: '台股',
        targetKey: 'tw_stock',
        targetType: 'assetType',
        targetPercent: 0.5,
        tolerancePercent: 0.05,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uuidv4(),
        label: '美股',
        targetKey: 'us_stock',
        targetType: 'assetType',
        targetPercent: 0.3,
        tolerancePercent: 0.05,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uuidv4(),
        label: '基金',
        targetKey: 'fund',
        targetType: 'assetType',
        targetPercent: 0.2,
        tolerancePercent: 0.05,
        createdAt: now(),
        updatedAt: now(),
      },
    ])
  }

  console.log(`Financial_Accounting v${APP_VERSION} initialized.`)
}
