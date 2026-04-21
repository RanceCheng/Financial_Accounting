import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { Account } from '@/data/types'
import { accountRepo } from '@/data/repositories'
import { AccountSchema, AccountInput } from '@/data/schemas'
import { ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_LABELS } from '@/lib/constants'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Plus, Edit2, Trash2 } from 'lucide-react'

const emptyForm = (): AccountInput => ({
  name: '',
  type: 'brokerage',
  currency: 'TWD',
  note: '',
})

export function AccountManager() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Account | null>(null)
  const [form, setForm] = useState<AccountInput>(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm())
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item: Account) => {
    setEditItem(item)
    setForm({ name: item.name, type: item.type, currency: item.currency, note: item.note ?? '' })
    setErrors({})
    setModalOpen(true)
  }

  const handleSave = async () => {
    const result = AccountSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message })
      setErrors(errs)
      return
    }
    if (editItem) {
      await accountRepo.update(editItem.id, form)
    } else {
      await accountRepo.add(form)
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (deleteId) {
      await accountRepo.delete(deleteId)
      setDeleteId(null)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">帳戶管理</h3>
        <button onClick={openAdd} className="btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          新增帳戶
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>帳戶名稱</th>
              <th>類型</th>
              <th>幣別</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-8">尚無帳戶</td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.name}</td>
                <td>{ACCOUNT_TYPE_LABELS[a.type]}</td>
                <td>{a.currency}</td>
                <td className="text-gray-400 text-sm">{a.note || '-'}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? '編輯帳戶' : '新增帳戶'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label className="label">帳戶名稱 *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：富邦證券" />
            {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="label">類型</label>
            <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountInput['type'] })}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as AccountInput['currency'] })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="label">備註</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">儲存</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="刪除帳戶"
        message="確定要刪除此帳戶嗎？"
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  )
}
