import { db } from '@/data/db'

export type HealthSeverity = 'error' | 'warning' | 'info'

export interface HealthIssue {
  id: string
  severity: HealthSeverity
  category: string
  message: string
  detail?: string
}

export interface HealthReport {
  checkedAt: string
  issues: HealthIssue[]
  counts: { error: number; warning: number; info: number; total: number }
  stats: {
    accounts: number
    assets: number
    investmentTx: number
    incomeExpenseRecords: number
    categories: number
    transfers: number
  }
}

export async function runHealthCheck(): Promise<HealthReport> {
  const [
    accounts, assets, investmentTransactions,
    incomeExpenseRecords, monthlyExpensePlans,
    categories, accountTransfers,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.assets.toArray(),
    db.investmentTransactions.toArray(),
    db.incomeExpenseRecords.toArray(),
    db.monthlyExpensePlans.toArray(),
    db.categories.toArray(),
    db.accountTransfers.toArray(),
  ])

  const issues: HealthIssue[] = []
  let seq = 0
  const id = () => String(++seq)

  const assetIds = new Set(assets.map(a => a.id))
  const accountIds = new Set(accounts.map(a => a.id))
  const categoryIds = new Set(categories.map(c => c.id))

  // ── 投資交易 ──
  for (const tx of investmentTransactions) {
    if (!assetIds.has(tx.assetId)) {
      issues.push({ id: id(), severity: 'error', category: '投資交易', message: `交易引用不存在的資產`, detail: `交易 ID: ${tx.id}，資產 ID: ${tx.assetId}` })
    }
    if (!accountIds.has(tx.accountId)) {
      issues.push({ id: id(), severity: 'error', category: '投資交易', message: `交易引用不存在的帳戶`, detail: `交易 ID: ${tx.id}，帳戶 ID: ${tx.accountId}` })
    }
    if (tx.quantity < 0) {
      issues.push({ id: id(), severity: 'warning', category: '投資交易', message: `交易數量為負數`, detail: `交易 ID: ${tx.id}，數量: ${tx.quantity}` })
    }
    if (tx.price < 0) {
      issues.push({ id: id(), severity: 'warning', category: '投資交易', message: `交易價格為負數`, detail: `交易 ID: ${tx.id}，價格: ${tx.price}` })
    }
  }

  // ── 收支記錄 ──
  for (const rec of incomeExpenseRecords) {
    if (!categoryIds.has(rec.categoryId)) {
      issues.push({ id: id(), severity: 'error', category: '收支記錄', message: `收支記錄引用不存在的分類`, detail: `記錄 ID: ${rec.id}，分類 ID: ${rec.categoryId}` })
    }
    if (rec.amount <= 0) {
      issues.push({ id: id(), severity: 'warning', category: '收支記錄', message: `收支金額不大於零`, detail: `記錄 ID: ${rec.id}，金額: ${rec.amount}` })
    }
  }

  // ── 固定月計畫 ──
  for (const plan of monthlyExpensePlans) {
    if (!categoryIds.has(plan.categoryId)) {
      issues.push({ id: id(), severity: 'warning', category: '固定月計畫', message: `固定計畫引用不存在的分類`, detail: `計畫 ID: ${plan.id}，分類 ID: ${plan.categoryId}` })
    }
  }

  // ── 帳戶轉帳 ──
  for (const tr of accountTransfers) {
    if (!accountIds.has(tr.fromAccountId)) {
      issues.push({ id: id(), severity: 'error', category: '帳戶轉帳', message: `轉帳引用不存在的來源帳戶`, detail: `轉帳 ID: ${tr.id}，帳戶 ID: ${tr.fromAccountId}` })
    }
    if (!accountIds.has(tr.toAccountId)) {
      issues.push({ id: id(), severity: 'error', category: '帳戶轉帳', message: `轉帳引用不存在的目標帳戶`, detail: `轉帳 ID: ${tr.id}，帳戶 ID: ${tr.toAccountId}` })
    }
  }

  // ── 帳戶餘額異常 ──
  for (const acc of accounts) {
    if (acc.balance < 0) {
      issues.push({ id: id(), severity: 'warning', category: '帳戶', message: `帳戶餘額為負數`, detail: `帳戶「${acc.name}」，餘額: ${acc.balance}` })
    }
  }

  // ── 資產異常 ──
  for (const asset of assets) {
    if ((asset.quantity ?? 0) < 0) {
      issues.push({ id: id(), severity: 'warning', category: '資產', message: `資產持有數量為負數`, detail: `資產「${asset.name}」(${asset.ticker})，數量: ${asset.quantity}` })
    }
    if (!asset.ticker.trim()) {
      issues.push({ id: id(), severity: 'info', category: '資產', message: `資產代號（Ticker）為空`, detail: `資產「${asset.name}」，ID: ${asset.id}` })
    }
  }

  // ── 孤立資產（有資產但完全沒有任何交易紀錄）──
  const assetsWithTx = new Set(investmentTransactions.map(t => t.assetId))
  for (const asset of assets) {
    if (!assetsWithTx.has(asset.id) && asset.assetType !== 'cash') {
      issues.push({ id: id(), severity: 'info', category: '資產', message: `資產無任何交易紀錄`, detail: `資產「${asset.name}」(${asset.ticker})` })
    }
  }

  // ── 重複 Ticker ──
  const tickerMap = new Map<string, string[]>()
  for (const asset of assets) {
    const key = `${asset.ticker}_${asset.market}`
    if (!tickerMap.has(key)) tickerMap.set(key, [])
    tickerMap.get(key)!.push(asset.name)
  }
  for (const [key, names] of tickerMap.entries()) {
    if (names.length > 1) {
      const [ticker, market] = key.split('_')
      issues.push({ id: id(), severity: 'warning', category: '資產', message: `同市場存在重複 Ticker「${ticker}」(${market})`, detail: `資產：${names.join('、')}` })
    }
  }

  const counts = {
    error: issues.filter(i => i.severity === 'error').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
    total: issues.length,
  }

  return {
    checkedAt: new Date().toISOString(),
    issues,
    counts,
    stats: {
      accounts: accounts.length,
      assets: assets.length,
      investmentTx: investmentTransactions.length,
      incomeExpenseRecords: incomeExpenseRecords.length,
      categories: categories.length,
      transfers: accountTransfers.length,
    },
  }
}
