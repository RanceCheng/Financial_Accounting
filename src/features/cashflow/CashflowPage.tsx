import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { IncomeExpenseRecord, Category, MonthlyExpensePlan } from '@/data/types'
import { incomeExpenseRepo, monthlyPlanRepo, categoryRepo } from '@/data/repositories'
import {
  IncomeExpenseRecordInput,
  IncomeExpenseRecordSchema,
  MonthlyExpensePlanInput,
  MonthlyExpensePlanSchema,
  CategoryInput,
} from '@/data/schemas'
import { CURRENCIES, CASH_FLOW_TYPES, CASH_FLOW_TYPE_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate, formatPercent, getMonthKey, getMonthLabel } from '@/lib/formatters'
import { calcMonthlySummaries, calcExpenseByCategory } from '@/data/services'
import { ImportExportButtons } from '@/components/common/ImportExportButtons'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatCard } from '@/components/common/StatCard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { Plus, Edit2, Trash2, DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

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

const emptyPlanForm = (): MonthlyExpensePlanInput => ({
  yearMonth: new Date().toISOString().slice(0, 7),
  categoryId: '',
  plannedAmount: 0,
  currency: 'TWD',
  note: '',
})

export function CashflowPage() {
  const records = useLiveQuery(() => db.incomeExpenseRecords.orderBy('date').reverse().toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const plans = useLiveQuery(() => db.monthlyExpensePlans.toArray(), []) ?? []

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

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const incomeCategories = useMemo(() => {
    const seen = new Set<string>()
    return categories.filter((c) => {
      if (c.type !== 'income' || seen.has(c.name)) return false
      seen.add(c.name)
      return true
    })
  }, [categories])
  const expenseCategories = useMemo(() => {
    const seen = new Set<string>()
    return categories.filter((c) => {
      if (c.type !== 'expense' || seen.has(c.name)) return false
      seen.add(c.name)
      return true
    })
  }, [categories])

  const monthlySummaries = useMemo(() => calcMonthlySummaries(records, plans), [records, plans])
  const expenseByCat = useMemo(
    () => calcExpenseByCategory(records, categories, selectedMonth),
    [records, categories, selectedMonth]
  )

  const currentSummary = monthlySummaries.find((s) => s.yearMonth === selectedMonth)

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    records.forEach((r) => months.add(getMonthKey(r.date)))
    plans.forEach((p) => months.add(p.yearMonth))
    months.add(new Date().toISOString().slice(0, 7))
    return Array.from(months).sort().reverse()
  }, [records, plans])

  // Record CRUD
  const openAddRecord = () => {
    setEditRecord(null)
    setRecordForm(emptyRecordForm())
    setRecordErrors({})
    setRecordModal(true)
  }

  const openEditRecord = (r: IncomeExpenseRecord) => {
    setEditRecord(r)
    setRecordForm({ date: r.date, type: r.type, categoryId: r.categoryId, amount: r.amount, currency: r.currency, fxRateToBase: r.fxRateToBase, note: r.note ?? '' })
    setRecordErrors({})
    setRecordModal(true)
  }

  const handleSaveRecord = async () => {
    const result = IncomeExpenseRecordSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(recordForm)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[String(e.path[0])] = e.message })
      setRecordErrors(errs)
      return
    }
    if (editRecord) {
      await incomeExpenseRepo.update(editRecord.id, recordForm)
    } else {
      await incomeExpenseRepo.add(recordForm)
    }
    setRecordModal(false)
  }

  const handleDeleteRecord = async () => {
    if (deleteRecordId) {
      await incomeExpenseRepo.delete(deleteRecordId)
      setDeleteRecordId(null)
    }
  }

  // Plan CRUD
  const openAddPlan = () => {
    setEditPlan(null)
    setPlanForm(emptyPlanForm())
    setPlanErrors({})
    setPlanModal(true)
  }

  const openEditPlan = (p: MonthlyExpensePlan) => {
    setEditPlan(p)
    setPlanForm({ yearMonth: p.yearMonth, categoryId: p.categoryId, plannedAmount: p.plannedAmount, currency: p.currency, note: p.note ?? '' })
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

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'monthly', label: '月度總覽' },
    { id: 'records', label: '收支紀錄' },
    { id: 'plans', label: '月支出計畫' },
    { id: 'categories', label: '分類管理' },
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
          <select className="select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{getMonthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="月收入"
          value={formatCurrency(currentSummary?.totalIncome ?? 0, 'TWD')}
          icon={<TrendingUp className="w-4 h-4" />}
          colorClass="text-green-600"
        />
        <StatCard
          label="月實際支出"
          value={formatCurrency(currentSummary?.totalExpense ?? 0, 'TWD')}
          icon={<TrendingDown className="w-4 h-4" />}
          colorClass="text-red-500"
        />
        <StatCard
          label="月預計支出"
          value={formatCurrency(currentSummary?.totalPlannedExpense ?? 0, 'TWD')}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          label="月結餘 / 儲蓄率"
          value={formatCurrency(currentSummary?.balance ?? 0, 'TWD')}
          subValue={currentSummary ? formatPercent(currentSummary.savingsRate) : '-'}
          icon={<Wallet className="w-4 h-4" />}
          colorClass={(currentSummary?.balance ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Monthly overview */}
      {tab === 'monthly' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly bar chart */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">月收支趨勢</h3>
            {monthlySummaries.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlySummaries.slice(-12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="yearMonth" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatCurrency(v, 'TWD'), name]}
                  />
                  <Legend />
                  <Bar dataKey="totalIncome" name="收入" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="totalExpense" name="支出" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="totalPlannedExpense" name="預計支出" fill="#f59e0b" radius={[3, 3, 0, 0]} />
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
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={expenseByCat}
                    dataKey="amount"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ categoryName, percent }) => `${categoryName} ${(percent * 100).toFixed(1)}%`}
                    labelLine={false}
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
              <div className="flex items-center justify-center h-64 text-gray-400">此月份無支出資料</div>
            )}
          </div>

          {/* Monthly table */}
          <div className="card lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-4">月度摘要表</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>月份</th>
                    <th className="text-right">收入</th>
                    <th className="text-right">實際支出</th>
                    <th className="text-right">預計支出</th>
                    <th className="text-right">結餘</th>
                    <th className="text-right">儲蓄率</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummaries.slice().reverse().map((s) => (
                    <tr
                      key={s.yearMonth}
                      className={s.yearMonth === selectedMonth ? 'bg-blue-50' : ''}
                      onClick={() => setSelectedMonth(s.yearMonth)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="font-medium">{getMonthLabel(s.yearMonth)}</td>
                      <td className="text-right text-green-600">{formatCurrency(s.totalIncome, 'TWD')}</td>
                      <td className="text-right text-red-500">{formatCurrency(s.totalExpense, 'TWD')}</td>
                      <td className="text-right text-yellow-600">{formatCurrency(s.totalPlannedExpense, 'TWD')}</td>
                      <td className={`text-right font-semibold ${s.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatCurrency(s.balance, 'TWD')}
                      </td>
                      <td className="text-right">{formatPercent(s.savingsRate)}</td>
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
            <button onClick={openAddRecord} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" />
              新增收支
            </button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>類型</th>
                  <th>分類</th>
                  <th>金額</th>
                  <th>幣別</th>
                  <th>備註</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-8">本月無紀錄</td></tr>
                )}
                {filteredRecords.map((r) => (
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
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">{getMonthLabel(selectedMonth)} 月支出計畫</h3>
            <button onClick={openAddPlan} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" />
              新增計畫
            </button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>分類</th>
                  <th>計畫金額</th>
                  <th>幣別</th>
                  <th>備註</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {plans
                  .filter((p) => p.yearMonth === selectedMonth)
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{getMonthLabel(p.yearMonth)}</td>
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
                {plans.filter((p) => p.yearMonth === selectedMonth).length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-8">本月無支出計畫</td></tr>
                )}
              </tbody>
            </table>
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
            <select className="select" value={recordForm.currency} onChange={(e) => setRecordForm({ ...recordForm, currency: e.target.value as IncomeExpenseRecordInput['currency'], fxRateToBase: e.target.value === 'TWD' ? 1 : recordForm.fxRateToBase })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {recordForm.currency !== 'TWD' && (
            <div className="form-group">
              <label className="label">匯率 (對 TWD)</label>
              <input type="number" min="0.0001" step="0.01" className="input" value={recordForm.fxRateToBase} onChange={(e) => setRecordForm({ ...recordForm, fxRateToBase: Number(e.target.value) })} />
            </div>
          )}
          <div className={`form-group ${recordForm.currency !== 'TWD' ? '' : 'col-span-2'}`}>
            <label className="label">備註</label>
            <input className="input" value={recordForm.note} onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setRecordModal(false)} className="btn-secondary">取消</button>
          <button onClick={handleSaveRecord} className="btn-primary">儲存</button>
        </div>
      </Modal>

      {/* Plan Modal */}
      <Modal isOpen={planModal} onClose={() => setPlanModal(false)} title={editPlan ? '編輯月支出計畫' : '新增月支出計畫'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">月份 *</label>
            <input type="month" className="input" value={planForm.yearMonth} onChange={(e) => setPlanForm({ ...planForm, yearMonth: e.target.value })} />
            {planErrors.yearMonth && <span className="text-xs text-red-500">{planErrors.yearMonth}</span>}
          </div>
          <div className="form-group">
            <label className="label">分類 *</label>
            <select className="select" value={planForm.categoryId} onChange={(e) => setPlanForm({ ...planForm, categoryId: e.target.value })}>
              <option value="">請選擇</option>
              {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        title="刪除月支出計畫"
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
