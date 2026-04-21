import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { Asset } from '@/data/types'
import { assetRepo } from '@/data/repositories'
import { AssetSchema, AssetInput } from '@/data/schemas'
import { ASSET_TYPES, MARKETS, CURRENCIES, ASSET_TYPE_LABELS, MARKET_LABELS } from '@/lib/constants'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Plus, Edit2, Trash2 } from 'lucide-react'

const emptyForm = (): AssetInput => ({
  name: '',
  ticker: '',
  assetType: 'tw_stock',
  market: 'TW',
  currency: 'TWD',
  note: '',
})

export function AssetManager() {
  const assets = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Asset | null>(null)
  const [form, setForm] = useState<AssetInput>(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm())
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item: Asset) => {
    setEditItem(item)
    setForm({
      name: item.name,
      ticker: item.ticker,
      assetType: item.assetType,
      market: item.market,
      currency: item.currency,
      note: item.note ?? '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleSave = async () => {
    const result = AssetSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message })
      setErrors(errs)
      return
    }

    if (editItem) {
      await assetRepo.update(editItem.id, form)
    } else {
      await assetRepo.add(form)
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (deleteId) {
      await assetRepo.delete(deleteId)
      setDeleteId(null)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">資產管理</h3>
        <button onClick={openAdd} className="btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          新增資產
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>名稱</th>
              <th>代號</th>
              <th>類型</th>
              <th>市場</th>
              <th>幣別</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8">
                  尚無資產，請先新增
                </td>
              </tr>
            )}
            {assets.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.name}</td>
                <td className="font-mono">{a.ticker}</td>
                <td>{ASSET_TYPE_LABELS[a.assetType]}</td>
                <td>{MARKET_LABELS[a.market]}</td>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? '編輯資產' : '新增資產'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label className="label">資產名稱 *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：台積電" />
            {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="label">代號 *</label>
            <input className="input" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="例：2330" />
            {errors.ticker && <span className="text-xs text-red-500">{errors.ticker}</span>}
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as AssetInput['currency'] })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">資產類型</label>
            <select className="select" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value as AssetInput['assetType'] })}>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">市場</label>
            <select className="select" value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as AssetInput['market'] })}>
              {MARKETS.map((m) => <option key={m} value={m}>{MARKET_LABELS[m]}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="label">備註</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="選填" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">儲存</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="刪除資產"
        message="確定要刪除此資產嗎？相關的交易紀錄不會被刪除。"
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  )
}
