import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { RebalanceTarget } from '@/data/types'
import { rebalanceTargetRepo } from '@/data/repositories'
import { RebalanceTargetInput, RebalanceTargetSchema } from '@/data/schemas'
import {
  calcAllocationByAssetType,
  calcAllocationByCurrency,
} from '@/data/services'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { ImportExportButtons } from '@/components/common/ImportExportButtons'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SortTh } from '@/components/common/SortTh'
import { useSortable, sortByKey } from '@/lib/sorting'
import { ASSET_TYPES, CURRENCIES, ASSET_TYPE_LABELS, CURRENCY_LABELS } from '@/lib/constants'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Plus, Edit2, Trash2, Target, AlertCircle, CheckCircle2 } from 'lucide-react'

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const emptyTargetForm = (): RebalanceTargetInput => ({
  label: '',
  targetKey: 'tw_stock',
  targetType: 'assetType',
  targetPercent: 0.25,
  tolerancePercent: 0.05,
})

export function RebalancePage() {
  const transactions = useLiveQuery(() => db.investmentTransactions.toArray(), []) ?? []
  const assets = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const rebalanceTargets = useLiveQuery(() => db.rebalanceTargets.toArray(), []) ?? []

  const [view, setView] = useState<'assetType' | 'currency'>('assetType')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<RebalanceTarget | null>(null)
  const [form, setForm] = useState<RebalanceTargetInput>(emptyTargetForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { sortKey, sortDir, handleSort } = useSortable('label')

  const sortedTargets = useMemo(() => sortByKey(rebalanceTargets, sortKey, sortDir, (t, key) => {
    switch (key) {
      case 'label': return t.label
      case 'targetType': return t.targetType === 'assetType' ? '資產類型' : '幣別'
      case 'targetPercent': return t.targetPercent
      case 'tolerancePercent': return t.tolerancePercent
      default: return ''
    }
  }), [rebalanceTargets, sortKey, sortDir])

  const allocationByType = useMemo(
    () => calcAllocationByAssetType(transactions, assets, rebalanceTargets),
    [transactions, assets, rebalanceTargets]
  )
  const allocationByCurrency = useMemo(
    () => calcAllocationByCurrency(transactions, assets, rebalanceTargets),
    [transactions, assets, rebalanceTargets]
  )

  const allocation = view === 'assetType' ? allocationByType : allocationByCurrency
  const totalTWD = allocation.reduce((s, a) => s + a.currentAmountTWD, 0)

  const chartData = allocation.map((a) => ({
    name: a.label,
    value: a.currentAmountTWD,
  }))

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyTargetForm())
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item: RebalanceTarget) => {
    setEditItem(item)
    setForm({
      label: item.label,
      targetKey: item.targetKey,
      targetType: item.targetType,
      targetPercent: item.targetPercent,
      tolerancePercent: item.tolerancePercent,
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleSave = async () => {
    const result = RebalanceTargetSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[String(e.path[0])] = e.message })
      setErrors(errs)
      return
    }
    if (editItem) {
      await rebalanceTargetRepo.update(editItem.id, form)
    } else {
      await rebalanceTargetRepo.add(form)
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (deleteId) {
      await rebalanceTargetRepo.delete(deleteId)
      setDeleteId(null)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">資產再平衡表</h1>
          <p className="text-gray-500 text-sm mt-1">資產配置分析與再平衡建議</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAdd} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            設定目標
          </button>
          <ImportExportButtons />
        </div>
      </div>

      {/* Summary */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-700">總資產（以 TWD 計算）</span>
        </div>
        <div className="text-3xl font-bold text-blue-600">{formatCurrency(totalTWD, 'TWD')}</div>
        <p className="text-xs text-gray-400 mt-1">注意：目前以成本計算，非市值</p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('assetType')}
          className={`btn-sm ${view === 'assetType' ? 'btn-primary' : 'btn-secondary'}`}
        >
          依資產類型
        </button>
        <button
          onClick={() => setView('currency')}
          className={`btn-sm ${view === 'currency' ? 'btn-primary' : 'btn-secondary'}`}
        >
          依幣別
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">配置圖</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  labelLine={false}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, 'TWD')} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">尚無資料</div>
          )}
        </div>

        {/* Allocation table */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">配置明細與建議</h3>
          {allocation.length === 0 ? (
            <div className="text-center text-gray-400 py-8">尚無持倉資料</div>
          ) : (
            <div className="space-y-3">
              {allocation.map((item, i) => (
                <div key={item.key} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    {item.targetPercent > 0 && (
                      item.isWithinTolerance ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-600">
                    <div>目前：{formatPercent(item.currentPercent)}</div>
                    <div>目標：{item.targetPercent > 0 ? formatPercent(item.targetPercent) : '-'}</div>
                    <div>目前金額：{formatCurrency(item.currentAmountTWD, 'TWD')}</div>
                    <div>
                      建議調整：
                      <span className={item.diffAmountTWD > 0 ? 'text-blue-600' : item.diffAmountTWD < 0 ? 'text-red-500' : 'text-gray-400'}>
                        {item.targetPercent > 0
                          ? `${item.diffAmountTWD > 0 ? '+' : ''}${formatCurrency(item.diffAmountTWD, 'TWD')}`
                          : '-'}
                      </span>
                    </div>
                  </div>
                  {item.targetPercent > 0 && (
                    <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, (item.currentPercent / item.targetPercent) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Targets Management */}
      <div className="card mt-6">
        <h3 className="font-semibold text-gray-800 mb-4">目標配置設定</h3>
        {rebalanceTargets.length === 0 ? (
          <div className="text-center text-gray-400 py-6">尚未設定目標配置</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="標籤" sortKey="label" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="類型" sortKey="targetType" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th>對應項目</th>
                  <SortTh label="目標比例" sortKey="targetPercent" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                  <SortTh label="容忍偏差" sortKey="tolerancePercent" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedTargets.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.label}</td>
                    <td>{t.targetType === 'assetType' ? '資產類型' : '幣別'}</td>
                    <td>
                      {t.targetType === 'assetType'
                        ? ASSET_TYPE_LABELS[t.targetKey as keyof typeof ASSET_TYPE_LABELS] ?? t.targetKey
                        : CURRENCY_LABELS[t.targetKey as keyof typeof CURRENCY_LABELS] ?? t.targetKey}
                    </td>
                    <td>{formatPercent(t.targetPercent)}</td>
                    <td>±{formatPercent(t.tolerancePercent)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? '編輯目標配置' : '新增目標配置'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label className="label">標籤 *</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="例：台股部位" />
            {errors.label && <span className="text-xs text-red-500">{errors.label}</span>}
          </div>
          <div className="form-group">
            <label className="label">分類方式</label>
            <select className="select" value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value as RebalanceTargetInput['targetType'], targetKey: e.target.value === 'assetType' ? 'tw_stock' : 'TWD' })}>
              <option value="assetType">資產類型</option>
              <option value="currency">幣別</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">對應項目</label>
            <select className="select" value={form.targetKey} onChange={(e) => setForm({ ...form, targetKey: e.target.value })}>
              {form.targetType === 'assetType'
                ? ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>)
                : CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">目標比例 (%)</label>
            <input type="number" min="0" max="100" step="1" className="input" value={(form.targetPercent * 100).toFixed(0)} onChange={(e) => setForm({ ...form, targetPercent: Number(e.target.value) / 100 })} />
          </div>
          <div className="form-group">
            <label className="label">容忍偏差 (%)</label>
            <input type="number" min="0" max="100" step="1" className="input" value={(form.tolerancePercent * 100).toFixed(0)} onChange={(e) => setForm({ ...form, tolerancePercent: Number(e.target.value) / 100 })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">儲存</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="刪除目標配置"
        message="確定要刪除此目標配置嗎？"
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  )
}
