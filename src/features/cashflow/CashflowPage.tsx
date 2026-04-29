import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { IncomeExpenseRecord, Category, MonthlyExpensePlan } from '@/data/types'
import { incomeExpenseRepo, monthlyPlanRepo, categoryRepo, accountRepo } from '@/data/repositories'
import {
  IncomeExpenseRecordInput,
  IncomeExpenseRecordSchema,
  MonthlyExpensePlanInput,
  MonthlyExpensePlanSchema,
  CategoryInput,
} from '@/data/schemas'
import { CURRENCIES, CASH_FLOW_TYPES, CASH_FLOW_TYPE_LABELS, Currency } from '@/lib/constants'
import { formatCurrency, formatDate, formatPercent, getMonthKey, getMonthLabel } from '@/lib/formatters'
import { calcMonthlySummaries, calcExpenseByCategory } from '@/data/services'
import { ImportExportButtons } from '@/components/common/ImportExportButtons'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatCard } from '@/components/common/StatCard'
import { SortTh } from '@/components/common/SortTh'
import { useSortable, sortByKey } from '@/lib/sorting'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine
} from 'recharts'
import { Plus, Edit2, Trash2, DollarSign, TrendingUp, TrendingDown, Wallet, Banknote, ClipboardList, ArrowDownToLine } from 'lucide-react'

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#06b6d4']

type MainTab = 'records' | 'monthly' | 'categories' | 'plans'

const emptyRecordForm = (): IncomeExpenseRecordInput => ({
  date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  categoryId: '',
  amount: 0,
  currency: 'TWD',
  fxRateToBase: 1,
  note: '',
})

const emptyPlanForm = (type: MonthlyExpensePlanInput['type'] = 'expense'): MonthlyExpensePlanInput => ({
  type,
  categoryId: '',
  plannedAmount: 0,
  currency: 'TWD',
  note: '',
})

export function CashflowPage() {
  const records = useLiveQuery(() => db.incomeExpenseRecords.orderBy('date').reverse().toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const plans = useLiveQuery(() => db.monthlyExpensePlans.toArray(), []) ?? []
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const exchangeRate = useLiveQuery(() => db.exchangeRates.get('current'), [])

  const [tab, setTab] = useState<MainTab>('monthly')
  const [recordModal, setRecordModal] = useState(false)
  const [editRecord, setEditRecord] = useState<IncomeExpenseRecord | null>(null)
  const [recordForm, setRecordForm] = useState<IncomeExpenseRecordInput>(emptyRecordForm())
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({})
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null)

  const [planModal, setPlanModal] = useState(false)
  const [editPlan, setEditPlan] = useState<MonthlyExpensePlan | null>(null)
  const [planForm, setPlanForm] = useState<MonthlyExpensePlanInput>(emptyPlanForm())
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({})
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)

  const [catModal, setCatModal] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [catForm, setCatForm] = useState<CategoryInput>({ name: '', type: 'expense' })
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null)

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const [importPlanModal, setImportPlanModal] = useState(false)
  const [importPlanSelected, setImportPlanSelected] = useState<Set<string>>(new Set())
  const [importPlanDate, setImportPlanDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [importPlanAccounts, setImportPlanAccounts] = useState<Record<string, string>>({})

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const incomeCategories = useMemo(() => {
    const seen = new Set<string>()
    return categories
      .filter((c) => {
        if (c.type !== 'income' || seen.has(c.name)) return false
        seen.add(c.name)
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW-u-co-stroke'))
  }, [categories])
  const expenseCategories = useMemo(() => {
    const seen = new Set<string>()
    return categories
      .filter((c) => {
        if (c.type !== 'expense' || seen.has(c.name)) return false
        seen.add(c.name)
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW-u-co-stroke'))
  }, [categories])

  const monthlySummaries = useMemo(() => calcMonthlySummaries(records, plans.filter(p => (p.type ?? 'expense') === 'expense')), [records, plans])
  const totalFixedPlan = useMemo(() => plans.filter(p => (p.type ?? 'expense') === 'expense').reduce((sum, p) => sum + p.plannedAmount, 0), [plans])

  const [showCashBreakdown, setShowCashBreakdown] = useState(false)

  const getFx = (currency: string): number => {
    if (!exchangeRate || currency === 'TWD') return 1
    if (currency === 'USD' && exchangeRate.usdRate > 0) return exchangeRate.usdRate
    if (currency === 'JPY' && exchangeRate.jpyRate > 0) return exchangeRate.jpyRate
    if (currency === 'CNY' && exchangeRate.cnyRate > 0) return exchangeRate.cnyRate
    return 1
  }

  const cashAccountBreakdown = useMemo(() =>
    accounts
      .filter(a => a.type === 'cash')
      .map(a => ({ ...a, balanceTWD: (a.balance ?? 0) * getFx(a.currency) }))
      .sort((a, b) => b.balanceTWD - a.balanceTWD)
  , [accounts, exchangeRate])

  const cashAccountTotalTWD = useMemo(() =>
    cashAccountBreakdown.reduce((sum, a) => sum + a.balanceTWD, 0)
  , [cashAccountBreakdown])
  const expenseByCat = useMemo(
    () => calcExpenseByCategory(records, categories, selectedMonth).sort((a, b) => b.amount - a.amount),
    [records, categories, selectedMonth]
  )

  const currentSummary = monthlySummaries.find((s) => s.yearMonth === selectedMonth)

  // 只顯示有實際收支紀錄的月份
  const displayMonths = useMemo(() => {
    const months = new Set<string>()
    records.forEach((r) => months.add(getMonthKey(r.date)))
    return Array.from(months).sort().reverse()
  }, [records])

  // Record CRUD
  const openAddRecord = () => {
    setEditRecord(null)
    setRecordForm(emptyRecordForm())
    setRecordErrors({})
    setRecordModal(true)
  }

  const openEditRecord = (r: IncomeExpenseRecord) => {
    setEditRecord(r)
    setRecordForm({ date: r.date, type: r.type, categoryId: r.categoryId, accountId: r.accountId, amount: r.amount, currency: r.currency, fxRateToBase: r.fxRateToBase, note: r.note ?? '' })
    setRecordErrors({})
    setRecordModal(true)
  }

  const applyAccountBalance = async (accountId: string | undefined, type: 'income' | 'expense', amount: number, reverse = false) => {
    if (!accountId) return
    const acc = await db.accounts.get(accountId)
    if (!acc) return
    const delta = (type === 'income' ? amount : -amount) * (reverse ? -1 : 1)
    await accountRepo.update(accountId, { balance: (acc.balance ?? 0) + delta })
  }

  const handleSaveRecord = async () => {
    const result = IncomeExpenseRecordSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(recordForm)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[String(e.path[0])] = e.message })
      setRecordErrors(errs)
      return
    }
    const hasCashAccounts = accounts.some((a) => a.type === 'cash' && a.currency === recordForm.currency)
    if (hasCashAccounts && !recordForm.accountId) {
      setRecordErrors({ accountId: '請選擇現金帳戶' })
      return
    }
    if (editRecord) {
      // 先 reverse 舊帳戶效果，再 apply 新帳戶效果
      await applyAccountBalance(editRecord.accountId, editRecord.type, editRecord.amount, true)
      await applyAccountBalance(recordForm.accountId, recordForm.type as 'income' | 'expense', recordForm.amount)
      await incomeExpenseRepo.update(editRecord.id, recordForm)
    } else {
      await applyAccountBalance(recordForm.accountId, recordForm.type as 'income' | 'expense', recordForm.amount)
      await incomeExpenseRepo.add(recordForm)
    }
    setRecordModal(false)
  }

  const handleDeleteRecord = async () => {
    if (deleteRecordId) {
      const rec = records.find((r) => r.id === deleteRecordId)
      if (rec?.accountId) {
        const acc = await db.accounts.get(rec.accountId)
        if (acc) {
          const delta = rec.type === 'income' ? -(rec.amount) : rec.amount
          await accountRepo.update(rec.accountId, { balance: (acc.balance ?? 0) + delta })
        }
      }
      await incomeExpenseRepo.delete(deleteRecordId)
      setDeleteRecordId(null)
    }
  }

  // Import Plans
  const openImportPlanModal = () => {
    setImportPlanDate(`${selectedMonth}-01`)
    setImportPlanSelected(new Set(plans.map((p) => p.id)))
    const autoAccs: Record<string, string> = {}
    plans.filter(p => p.type === 'income').forEach(p => {
      const first = accounts.find(a => a.type === 'cash' && a.currency === p.currency)
      if (first) autoAccs[p.id] = first.id
    })
    setImportPlanAccounts(autoAccs)
    setImportPlanModal(true)
  }

  const toggleImportPlan = (id: string) => {
    setImportPlanSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleImportPlans = async () => {
    const selectedPlans = plans.filter((p) => importPlanSelected.has(p.id))
    for (const p of selectedPlans) {
      const planType = (p.type ?? 'expense') as 'income' | 'expense'
      const accountId = planType === 'income' ? (importPlanAccounts[p.id] || undefined) : undefined
      await applyAccountBalance(accountId, planType, p.plannedAmount)
      await incomeExpenseRepo.add({
        date: importPlanDate,
        type: planType,
        categoryId: p.categoryId,
        amount: p.plannedAmount,
        currency: p.currency,
        fxRateToBase: 1,
        note: p.note ?? '',
        accountId,
      })
    }
    setImportPlanModal(false)
    setImportPlanSelected(new Set())
    setImportPlanAccounts({})
  }

  // Plan CRUD
  const openAddPlan = (type: MonthlyExpensePlanInput['type'] = 'expense') => {
    setEditPlan(null)
    setPlanForm(emptyPlanForm(type))
    setPlanErrors({})
    setPlanModal(true)
  }

  const openEditPlan = (p: MonthlyExpensePlan) => {
    setEditPlan(p)
    setPlanForm({ type: ((p.type ?? 'expense') as MonthlyExpensePlanInput['type']), categoryId: p.categoryId, plannedAmount: p.plannedAmount, currency: p.currency, note: p.note ?? '' })
    setPlanErrors({})
    setPlanModal(true)
  }

  const handleSavePlan = async () => {
    const result = MonthlyExpensePlanSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(planForm)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[String(e.path[0])] = e.message })
      setPlanErrors(errs)
      return
    }
    if (editPlan) {
      await monthlyPlanRepo.update(editPlan.id, planForm)
    } else {
      await monthlyPlanRepo.add(planForm)
    }
    setPlanModal(false)
  }

  const handleDeletePlan = async () => {
    if (deletePlanId) {
      await monthlyPlanRepo.delete(deletePlanId)
      setDeletePlanId(null)
    }
  }

  // Category CRUD
  const openAddCat = () => {
    setEditCat(null)
    setCatForm({ name: '', type: 'expense' })
    setCatModal(true)
  }

  const openEditCat = (c: Category) => {
    setEditCat(c)
    setCatForm({ name: c.name, type: c.type })
    setCatModal(true)
  }

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) return
    if (editCat) {
      await categoryRepo.update(editCat.id, catForm)
    } else {
      await categoryRepo.add(catForm)
    }
    setCatModal(false)
  }

  const handleDeleteCat = async () => {
    if (deleteCatId) {
      await categoryRepo.delete(deleteCatId)
      setDeleteCatId(null)
    }
  }

  const filteredRecords = useMemo(
    () => records.filter((r) => getMonthKey(r.date) === selectedMonth),
    [records, selectedMonth]
  )

  // Sort states
  const { sortKey: mSortKey, sortDir: mSortDir, handleSort: handleMSort } = useSortable('yearMonth', 'desc')
  const { sortKey: rSortKey, sortDir: rSortDir, handleSort: handleRSort } = useSortable('date', 'desc')
  const { sortKey: pSortKey, sortDir: pSortDir, handleSort: handlePSort } = useSortable('plannedAmount', 'desc')
  const { sortKey: ipSortKey, sortDir: ipSortDir, handleSort: handleIPSort } = useSortable('plannedAmount', 'desc')

  const sortedSummaries = useMemo(() => sortByKey(monthlySummaries.filter(s => s.totalIncome > 0 || s.totalExpense > 0), mSortKey, mSortDir, (s, key) => {
    switch (key) {
      case 'yearMonth': return s.yearMonth
      case 'totalIncome': return s.totalIncome
      case 'totalExpense': return s.totalExpense
      case 'totalPlannedExpense': return s.totalPlannedExpense
      case 'balance': return s.balance
      case 'savingsRate': return s.savingsRate
      default: return ''
    }
  }), [monthlySummaries, mSortKey, mSortDir])

  const sortedRecords = useMemo(() => sortByKey(filteredRecords, rSortKey, rSortDir, (r, key) => {
    switch (key) {
      case 'date': return r.date
      case 'type': return CASH_FLOW_TYPE_LABELS[r.type]
      case 'category': return categoryMap.get(r.categoryId)?.name ?? ''
      case 'amount': return r.amount
      default: return ''
    }
  }), [filteredRecords, rSortKey, rSortDir, categoryMap])

  const sortedPlans = useMemo(() =>
    sortByKey(plans.filter(p => (p.type ?? 'expense') === 'expense'), pSortKey, pSortDir, (p, key) => {
      switch (key) {
        case 'category': return categoryMap.get(p.categoryId)?.name ?? ''
        case 'plannedAmount': return p.plannedAmount
        default: return ''
      }
    })
  , [plans, pSortKey, pSortDir, categoryMap])

  const sortedIncomePlans = useMemo(() =>
    sortByKey(plans.filter(p => p.type === 'income'), ipSortKey, ipSortDir, (p, key) => {
      switch (key) {
        case 'category': return categoryMap.get(p.categoryId)?.name ?? ''
        case 'plannedAmount': return p.plannedAmount
        default: return ''
      }
    })
  , [plans, ipSortKey, ipSortDir, categoryMap])

  const tabs: { id: MainTab; label: string; activeColor: string; inactiveColor: string }[] = [
    { id: 'monthly', label: '月度總覽', activeColor: 'bg-blue-500 text-white border-blue-500 shadow-sm', inactiveColor: 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50' },
    { id: 'records', label: '收支紀錄', activeColor: 'bg-emerald-500 text-white border-emerald-500 shadow-sm', inactiveColor: 'bg-white text-emerald-600 border-emerald-300 hover:bg-emerald-50' },
    { id: 'plans', label: '固定月計畫', activeColor: 'bg-amber-500 text-white border-amber-500 shadow-sm', inactiveColor: 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50' },
    { id: 'categories', label: '分類管理', activeColor: 'bg-violet-500 text-white border-violet-500 shadow-sm', inactiveColor: 'bg-white text-violet-600 border-violet-300 hover:bg-violet-50' },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收入與日常消費表</h1>
          <p className="text-gray-500 text-sm mt-1">管理收支記錄與月度分析</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAddRecord} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            新增收支
          </button>
          <ImportExportButtons />
        </div>
      </div>

      {/* Month selector + stat cards */}
      <div className="flex items-center gap-4 mb-6">
        <div className="form-group">
          <label className="label">選擇月份</label>
          <select className="select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} disabled={displayMonths.length === 0}>
            {displayMonths.length > 0
              ? displayMonths.map((m) => (
                  <option key={m} value={m}>{getMonthLabel(m)}</option>
                ))
              : <option value="">-</option>
            }
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="現金帳戶 (TWD)"
          value={formatCurrency(cashAccountTotalTWD, 'TWD')}
          icon={<Banknote className="w-4 h-4" />}
          colorClass="text-blue-600"
          onClick={() => setShowCashBreakdown(true)}
        />
        <StatCard
          label="月收入"
          value={currentSummary ? formatCurrency(currentSummary.totalIncome, 'TWD') : '-'}
          icon={<TrendingUp className="w-4 h-4" />}
          colorClass="text-green-600"
        />
        <StatCard
          label="月實際支出"
          value={currentSummary ? formatCurrency(currentSummary.totalExpense, 'TWD') : '-'}
          icon={<TrendingDown className="w-4 h-4" />}
          colorClass="text-red-500"
        />
        <StatCard
          label="月預計支出"
          value={currentSummary ? formatCurrency(currentSummary.totalPlannedExpense, 'TWD') : '-'}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          label="月結餘 / 儲蓄率"
          value={currentSummary ? formatCurrency(currentSummary.balance, 'TWD') : '-'}
          subValue={currentSummary ? formatPercent(currentSummary.savingsRate) : '-'}
          icon={<Wallet className="w-4 h-4" />}
          colorClass={currentSummary ? ((currentSummary.balance >= 0) ? 'text-green-600' : 'text-red-500') : undefined}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mt-4 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg border-2 transition-all ${
              tab === t.id ? t.activeColor : t.inactiveColor
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Monthly overview */}
      {tab === 'monthly' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly bar chart */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">月收支趨勢</h3>
            {displayMonths.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlySummaries.filter(s => s.totalIncome > 0 || s.totalExpense > 0).slice(-12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="yearMonth" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatCurrency(v, 'TWD'), name]}
                  />
                  <Legend />
                  <Bar dataKey="totalIncome" name="收入" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="totalExpense" name="支出" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  {totalFixedPlan > 0 && (
                    <ReferenceLine
                      y={totalFixedPlan}
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{ value: `計畫支出 ${formatCurrency(totalFixedPlan, 'TWD')}`, position: 'insideTopRight', fontSize: 11, fill: '#b45309' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">尚無資料</div>
            )}
          </div>

          {/* Expense by category pie */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">{getMonthLabel(selectedMonth)} 支出分類</h3>
            {expenseByCat.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                  <Pie
                    data={expenseByCat}
                    dataKey="amount"
                    nameKey="categoryName"
                    cx="50%"
                    cy="45%"
                    outerRadius={100}
                    label={({ categoryName, percent }) => `${categoryName} ${(percent * 100).toFixed(1)}%`}
                    labelLine={true}
                  >
                    {expenseByCat.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, 'TWD')} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400 text-2xl">-</div>
            )}
          </div>

          {/* Monthly table */}
          <div className="card lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-4">月度摘要表</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <SortTh label="月份" sortKey="yearMonth" current={mSortKey} dir={mSortDir} onSort={handleMSort} />
                    <SortTh label="收入" sortKey="totalIncome" current={mSortKey} dir={mSortDir} onSort={handleMSort} className="text-right" />
                    <SortTh label="實際支出" sortKey="totalExpense" current={mSortKey} dir={mSortDir} onSort={handleMSort} className="text-right" />
                    <SortTh label="預計支出" sortKey="totalPlannedExpense" current={mSortKey} dir={mSortDir} onSort={handleMSort} className="text-right" />
                    <SortTh label="結餘" sortKey="balance" current={mSortKey} dir={mSortDir} onSort={handleMSort} className="text-right" />
                    <SortTh label="儲蓄率" sortKey="savingsRate" current={mSortKey} dir={mSortDir} onSort={handleMSort} className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedSummaries.map((s) => (
                    <tr
                      key={s.yearMonth}
                      className={s.yearMonth === selectedMonth ? 'bg-blue-50' : ''}
                      onClick={() => setSelectedMonth(s.yearMonth)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="font-medium">{getMonthLabel(s.yearMonth)}</td>
                      <td className={`text-right ${s.totalIncome < 0 ? '!text-red-600 !font-bold' : '!text-green-600'}`}>{formatCurrency(s.totalIncome, 'TWD')}</td>
                      <td className={`text-right ${s.totalExpense < 0 ? '!text-red-600 !font-bold' : ''}`}>{formatCurrency(s.totalExpense, 'TWD')}</td>
                      <td className={`text-right ${s.totalPlannedExpense < 0 ? '!text-red-600 !font-bold' : ''}`}>{formatCurrency(s.totalPlannedExpense, 'TWD')}</td>
                      <td className={`text-right font-semibold ${s.balance < 0 ? '!text-red-600 !font-bold' : '!text-green-600'}`}>
                        {formatCurrency(s.balance, 'TWD')}
                      </td>
                      <td className={`text-right ${s.savingsRate < 0 ? '!text-red-600 !font-bold' : ''}`}>{formatPercent(s.savingsRate)}</td>
                    </tr>
                  ))}
                  {monthlySummaries.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-gray-400 py-8">尚無資料</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Records */}
      {tab === 'records' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">{getMonthLabel(selectedMonth)} 收支紀錄</h3>
            <div className="flex gap-2">
              <button onClick={openImportPlanModal} className="btn-secondary btn-sm" disabled={plans.length === 0}>
                <ClipboardList className="w-4 h-4" />
                匯入固定月計畫
              </button>
              <button onClick={openAddRecord} className="btn-primary btn-sm">
                <Plus className="w-4 h-4" />
                新增收支
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="日期" sortKey="date" current={rSortKey} dir={rSortDir} onSort={handleRSort} />
                  <th>類型</th>
                  <SortTh label="分類" sortKey="category" current={rSortKey} dir={rSortDir} onSort={handleRSort} />
                  <SortTh label="金額" sortKey="amount" current={rSortKey} dir={rSortDir} onSort={handleRSort} className="text-right" />
                  <th>幣別</th>
                  <th>備註</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-8">本月無紀錄</td></tr>
                )}
                {sortedRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      <span className={r.type === 'income' ? 'badge-income' : 'badge-expense'}>
                        {CASH_FLOW_TYPE_LABELS[r.type]}
                      </span>
                    </td>
                    <td>{categoryMap.get(r.categoryId)?.name ?? '-'}</td>
                    <td className={`text-right font-mono font-medium ${r.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount, r.currency)}
                    </td>
                    <td>{r.currency}</td>
                    <td className="text-xs text-gray-400">{r.note || '-'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEditRecord(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteRecordId(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plans */}
      {tab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 固定月支出計畫 */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-red-700">固定月支出計畫</h3>
              <button onClick={() => openAddPlan('expense')} className="btn-primary btn-sm">
                <Plus className="w-4 h-4" />
                新增支出計畫
              </button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <SortTh label="分類" sortKey="category" current={pSortKey} dir={pSortDir} onSort={handlePSort} />
                    <SortTh label="計畫金額" sortKey="plannedAmount" current={pSortKey} dir={pSortDir} onSort={handlePSort} className="text-right" />
                    <th>幣別</th>
                    <th>備註</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlans.map((p) => (
                    <tr key={p.id}>
                      <td>{categoryMap.get(p.categoryId)?.name ?? '-'}</td>
                      <td className="text-right font-mono">{formatCurrency(p.plannedAmount, p.currency)}</td>
                      <td>{p.currency}</td>
                      <td className="text-xs text-gray-400">{p.note || '-'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => openEditPlan(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeletePlanId(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sortedPlans.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-8">尚無固定支出計畫</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 月收入計畫 */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-emerald-700">固定月收入計畫</h3>
              <button onClick={() => openAddPlan('income')} className="btn-primary btn-sm">
                <Plus className="w-4 h-4" />
                新增收入計畫
              </button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <SortTh label="分類" sortKey="category" current={ipSortKey} dir={ipSortDir} onSort={handleIPSort} />
                    <SortTh label="計畫金額" sortKey="plannedAmount" current={ipSortKey} dir={ipSortDir} onSort={handleIPSort} className="text-right" />
                    <th>幣別</th>
                    <th>備註</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedIncomePlans.map((p) => (
                    <tr key={p.id}>
                      <td>{categoryMap.get(p.categoryId)?.name ?? '-'}</td>
                      <td className="text-right font-mono">{formatCurrency(p.plannedAmount, p.currency)}</td>
                      <td>{p.currency}</td>
                      <td className="text-xs text-gray-400">{p.note || '-'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => openEditPlan(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeletePlanId(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sortedIncomePlans.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-8">尚無固定收入計畫</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      {tab === 'categories' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">分類管理</h3>
            <button onClick={openAddCat} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" />
              新增分類
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2">收入分類</h4>
              <div className="space-y-2">
                {incomeCategories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <span className="text-sm font-medium">{c.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => openEditCat(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteCatId(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2">支出分類</h4>
              <div className="space-y-2">
                {expenseCategories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <span className="text-sm font-medium">{c.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => openEditCat(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteCatId(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 現金帳戶構成 Modal */}
      <Modal isOpen={showCashBreakdown} onClose={() => setShowCashBreakdown(false)} title="現金帳戶構成明細">
        {cashAccountBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">尚無現金帳戶</p>
        ) : (
          <div className="space-y-1">
            {cashAccountBreakdown.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <span className="font-medium text-slate-700">{a.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{a.currency}</span>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-semibold ${(a.balance ?? 0) < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                    {formatCurrency(a.balance ?? 0, a.currency)}
                  </div>
                  {a.currency !== 'TWD' && (
                    <div className="text-xs text-slate-400">≈ {formatCurrency(a.balanceTWD, 'TWD')}</div>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 mt-1">
              <span className="font-semibold text-slate-600">合計 (TWD)</span>
              <span className="font-mono font-bold text-blue-600">{formatCurrency(cashAccountTotalTWD, 'TWD')}</span>
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button className="btn-secondary" onClick={() => setShowCashBreakdown(false)}>關閉</button>
        </div>
      </Modal>

      {/* Record Modal */}
      <Modal isOpen={recordModal} onClose={() => setRecordModal(false)} title={editRecord ? '編輯收支' : '新增收支'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">日期 *</label>
            <input type="date" className="input" value={recordForm.date} onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">類型 *</label>
            <select className="select" value={recordForm.type} onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value as IncomeExpenseRecordInput['type'], categoryId: '' })}>
              {CASH_FLOW_TYPES.map((t) => <option key={t} value={t}>{CASH_FLOW_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="label">分類 *</label>
            <select className="select" value={recordForm.categoryId} onChange={(e) => setRecordForm({ ...recordForm, categoryId: e.target.value })}>
              <option value="">請選擇</option>
              {(recordForm.type === 'income' ? incomeCategories : expenseCategories).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {recordErrors.categoryId && <span className="text-xs text-red-500">{recordErrors.categoryId}</span>}
          </div>
          <div className="form-group">
            <label className="label">金額 *</label>
            <input type="number" min="0" step="0.01" className="input" value={recordForm.amount} onChange={(e) => setRecordForm({ ...recordForm, amount: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={recordForm.currency} onChange={(e) => {
              const cur = e.target.value as IncomeExpenseRecordInput['currency']
              let autoFx = recordForm.fxRateToBase
              if (cur === 'TWD') autoFx = 1
              else if (exchangeRate) {
                if (cur === 'USD' && exchangeRate.usdRate > 0) autoFx = exchangeRate.usdRate
                else if (cur === 'JPY' && exchangeRate.jpyRate > 0) autoFx = exchangeRate.jpyRate
                else if (cur === 'CNY' && exchangeRate.cnyRate > 0) autoFx = exchangeRate.cnyRate
              }
              setRecordForm({ ...recordForm, currency: cur, fxRateToBase: autoFx, accountId: undefined })
            }}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {recordForm.currency !== 'TWD' && (() => {
            const refFx = exchangeRate
              ? (recordForm.currency === 'USD' ? exchangeRate.usdRate
                : recordForm.currency === 'JPY' ? exchangeRate.jpyRate
                : recordForm.currency === 'CNY' ? exchangeRate.cnyRate
                : 0)
              : 0
            return (
              <div className="form-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">匯率 (1 {recordForm.currency} = ? TWD)</label>
                  {refFx > 0 && (
                    <button
                      type="button"
                      onClick={() => setRecordForm(prev => ({ ...prev, fxRateToBase: refFx }))}
                      title={`帶入系統匯率：${refFx}${exchangeRate?.updatedAt ? `（更新：${exchangeRate.updatedAt.slice(0,10)}）` : ''}`}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <ArrowDownToLine className="w-3 h-3" />
                      帶入參考匯率
                    </button>
                  )}
                </div>
                <input type="number" min="0.0001" step="0.0001" className="input" value={recordForm.fxRateToBase} onChange={(e) => setRecordForm({ ...recordForm, fxRateToBase: Number(e.target.value) })} />
                {refFx > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    參考：1 {recordForm.currency} ≈ {refFx} TWD
                    {exchangeRate?.updatedAt ? `（${exchangeRate.updatedAt.slice(0,10)} 更新）` : ''}
                  </p>
                )}
                {!exchangeRate && (
                  <p className="text-xs text-orange-400 mt-0.5">尚無匯率資料，請至投資紀錄表更新匯率</p>
                )}
              </div>
            )
          })()}
          <div className={`form-group ${recordForm.currency !== 'TWD' ? '' : 'col-span-2'}`}>
            <label className="label">備註</label>
            <input className="input" value={recordForm.note} onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })} />
            {(() => {
              const topNotes = [...records
                .map(r => r.note?.trim())
                .filter((n): n is string => !!n)
                .reduce((map, n) => { map.set(n, (map.get(n) ?? 0) + 1); return map }, new Map<string, number>())
                .entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([n]) => n)
              if (topNotes.length === 0) return null
              return (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {topNotes.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRecordForm(prev => ({ ...prev, note: n }))}
                      className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-gray-600 transition-colors"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
          {(() => {
            const cashAccounts = accounts
              .filter((a) => a.type === 'cash' && a.currency === recordForm.currency)
              .sort((a, b) => b.balance - a.balance)
            if (cashAccounts.length === 0) return null
            const selected = cashAccounts.find((a) => a.id === recordForm.accountId)
            const previewBal = selected
              ? (() => {
                  const newDelta = recordForm.type === 'income' ? recordForm.amount : -recordForm.amount
                  // 編輯模式且帳戶與原始相同時，需先 reverse 舊效果再加新效果
                  if (editRecord && editRecord.accountId === selected.id) {
                    const oldDelta = editRecord.type === 'income' ? editRecord.amount : -editRecord.amount
                    return selected.balance - oldDelta + newDelta
                  }
                  return selected.balance + newDelta
                })()
              : null
            return (
              <div className="form-group col-span-2">
                <label className="label">現金帳戶 *</label>
                <select
                  className="select"
                  value={recordForm.accountId ?? ''}
                  onChange={(e) => setRecordForm({ ...recordForm, accountId: e.target.value || undefined })}
                >
                  <option value="" disabled>請選擇</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}（現有 {formatCurrency(a.balance, a.currency)}）</option>
                  ))}
                </select>
                {recordErrors.accountId && <span className="text-xs text-red-500">{recordErrors.accountId}</span>}
                {previewBal !== null && (
                  <span className="text-xs text-gray-400 mt-0.5 block">儲存後餘額：{formatCurrency(previewBal, recordForm.currency as Currency)}</span>
                )}
              </div>
            )
          })()}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setRecordModal(false)} className="btn-secondary">取消</button>
          <button onClick={handleSaveRecord} className="btn-primary">儲存</button>
        </div>
      </Modal>

      {/* Plan Modal */}
      <Modal isOpen={planModal} onClose={() => setPlanModal(false)} title={
        editPlan
          ? (planForm.type === 'income' ? '編輯固定收入計畫' : '編輯固定支出計畫')
          : (planForm.type === 'income' ? '新增固定收入計畫' : '新增固定支出計畫')
      }>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label className="label">分類 *</label>
            <select className="select" value={planForm.categoryId} onChange={(e) => setPlanForm({ ...planForm, categoryId: e.target.value })}>
              <option value="">請選擇</option>
              {(planForm.type === 'income' ? incomeCategories : expenseCategories).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {planErrors.categoryId && <span className="text-xs text-red-500">{planErrors.categoryId}</span>}
          </div>
          <div className="form-group">
            <label className="label">計畫金額 *</label>
            <input type="number" min="0" step="0.01" className="input" value={planForm.plannedAmount} onChange={(e) => setPlanForm({ ...planForm, plannedAmount: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={planForm.currency} onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value as MonthlyExpensePlanInput['currency'] })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="label">備註</label>
            <input className="input" value={planForm.note} onChange={(e) => setPlanForm({ ...planForm, note: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setPlanModal(false)} className="btn-secondary">取消</button>
          <button onClick={handleSavePlan} className="btn-primary">儲存</button>
        </div>
      </Modal>

      {/* Import Plans Modal */}
      <Modal isOpen={importPlanModal} onClose={() => setImportPlanModal(false)} title="匯入固定月計畫" size="lg">
        <div className="form-group mb-4">
          <label className="label">匯入日期</label>
          <input type="date" className="input" value={importPlanDate} onChange={(e) => setImportPlanDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
          <input
            type="checkbox"
            id="import-select-all"
            checked={importPlanSelected.size === plans.length && plans.length > 0}
            onChange={(e) =>
              setImportPlanSelected(e.target.checked ? new Set(plans.map((p) => p.id)) : new Set())
            }
            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
          />
          <label htmlFor="import-select-all" className="text-sm font-semibold cursor-pointer">全部勾選</label>
          <span className="text-xs text-gray-400 ml-auto">已選 {importPlanSelected.size} / {plans.length} 項</span>
        </div>
        {sortedPlans.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-red-700 mb-2">固定月支出計畫</h4>
            <div className="space-y-1.5">
              {sortedPlans.map((p) => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importPlanSelected.has(p.id)}
                    onChange={() => toggleImportPlan(p.id)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="flex-1 text-sm font-medium">{categoryMap.get(p.categoryId)?.name ?? '-'}</span>
                  <span className="text-sm font-mono !text-red-500">{formatCurrency(p.plannedAmount, p.currency)}</span>
                  <span className="text-xs text-gray-400">{p.currency}</span>
                  {p.note && <span className="text-xs text-gray-400 truncate max-w-[8rem]">{p.note}</span>}
                </label>
              ))}
            </div>
          </div>
        )}
        {sortedIncomePlans.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-emerald-700 mb-2">固定月收入計畫</h4>
            <div className="space-y-1.5">
              {sortedIncomePlans.map((p) => {
                const cashAccs = accounts.filter(a => a.type === 'cash' && a.currency === p.currency)
                const isSelected = importPlanSelected.has(p.id)
                return (
                  <div key={p.id} className="rounded-lg border border-gray-100">
                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer rounded-lg">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleImportPlan(p.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="flex-1 text-sm font-medium">{categoryMap.get(p.categoryId)?.name ?? '-'}</span>
                      <span className="text-sm font-mono !text-emerald-600">{formatCurrency(p.plannedAmount, p.currency)}</span>
                      <span className="text-xs text-gray-400">{p.currency}</span>
                      {p.note && <span className="text-xs text-gray-400 truncate max-w-[8rem]">{p.note}</span>}
                    </label>
                    {isSelected && cashAccs.length > 0 && (
                      <div className="px-3 pb-2">
                        <select
                          className="select text-sm"
                          value={importPlanAccounts[p.id] ?? ''}
                          onChange={(e) => setImportPlanAccounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                        >
                          <option value="">不連結帳戶</option>
                          {cashAccs.sort((a, b) => b.balance - a.balance).map(a => (
                            <option key={a.id} value={a.id}>{a.name}（現有 {formatCurrency(a.balance, a.currency)}）</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {plans.length === 0 && (
          <div className="text-center text-gray-400 py-8">尚無固定月計畫，請先至「固定月計畫」分頁新增</div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setImportPlanModal(false)} className="btn-secondary">取消</button>
          <button onClick={handleImportPlans} className="btn-primary" disabled={importPlanSelected.size === 0}>
            匯入{importPlanSelected.size > 0 ? `（${importPlanSelected.size} 項）` : ''}
          </button>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal isOpen={catModal} onClose={() => setCatModal(false)} title={editCat ? '編輯分類' : '新增分類'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label className="label">分類名稱 *</label>
            <input className="input" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
          </div>
          <div className="form-group col-span-2">
            <label className="label">類型</label>
            <select className="select" value={catForm.type} onChange={(e) => setCatForm({ ...catForm, type: e.target.value as CategoryInput['type'] })}>
              {CASH_FLOW_TYPES.map((t) => <option key={t} value={t}>{CASH_FLOW_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setCatModal(false)} className="btn-secondary">取消</button>
          <button onClick={handleSaveCat} className="btn-primary">儲存</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteRecordId}
        title="刪除收支紀錄"
        message="確定要刪除此記錄嗎？"
        confirmLabel="刪除"
        onConfirm={handleDeleteRecord}
        onCancel={() => setDeleteRecordId(null)}
        danger
      />
      <ConfirmDialog
        isOpen={!!deletePlanId}
        title="刪除固定月計畫"
        message="確定要刪除此計畫嗎？"
        confirmLabel="刪除"
        onConfirm={handleDeletePlan}
        onCancel={() => setDeletePlanId(null)}
        danger
      />
      <ConfirmDialog
        isOpen={!!deleteCatId}
        title="刪除分類"
        message="確定要刪除此分類嗎？"
        confirmLabel="刪除"
        onConfirm={handleDeleteCat}
        onCancel={() => setDeleteCatId(null)}
        danger
      />
    </div>
  )
}
