import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { InvestmentTransaction } from '@/data/types'
import { investmentTxRepo } from '@/data/repositories'
import { InvestmentTransactionSchema, InvestmentTransactionInput } from '@/data/schemas'
import {
  CURRENCIES,
  INVESTMENT_TX_TYPES,
  INVESTMENT_TX_TYPE_LABELS,
  ASSET_TYPE_LABELS,
  MARKET_LABELS,
} from '@/lib/constants'
import { formatDate, formatNumber } from '@/lib/formatters'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Plus, Edit2, Trash2, Filter } from 'lucide-react'

const emptyForm = (): InvestmentTransactionInput => ({
  date: new Date().toISOString().slice(0, 10),
  assetId: '',
  accountId: '',
  txType: 'buy',
  quantity: 0,
  price: 0,
  currency: 'TWD',
  fxRateToBase: 1,
  fee: 0,
  tax: 0,
  note: '',
})

interface Filters {
  dateFrom: string
  dateTo: string
  currency: string
  market: string
  assetType: string
  accountId: string
  keyword: string
}

const emptyFilters = (): Filters => ({
  dateFrom: '',
  dateTo: '',
  currency: '',
  market: '',
  assetType: '',
  accountId: '',
  keyword: '',
})

const TX_TYPE_BADGE_CLASS: Record<string, string> = {
  buy: 'badge-buy',
  sell: 'badge-sell',
  dividend: 'badge-dividend',
  fee: 'badge-fee',
  tax: 'badge-tax',
  deposit: 'badge-deposit',
  withdrawal: 'badge-withdrawal',
}

export function TransactionList() {
  const transactions = useLiveQuery(() => db.investmentTransactions.orderBy('date').reverse().toArray(), []) ?? []
  const assets = useLiveQuery(() => db.assets.toArray(), []) ?? []
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<InvestmentTransaction | null>(null)
  const [form, setForm] = useState<InvestmentTransactionInput>(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters())
  const [showFilters, setShowFilters] = useState(false)

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.dateFrom && tx.date < filters.dateFrom) return false
      if (filters.dateTo && tx.date > filters.dateTo) return false
      if (filters.currency && tx.currency !== filters.currency) return false
      if (filters.accountId && tx.accountId !== filters.accountId) return false
      const asset = assetMap.get(tx.assetId)
      if (filters.market && asset?.market !== filters.market) return false
      if (filters.assetType && asset?.assetType !== filters.assetType) return false
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase()
        const name = asset?.name.toLowerCase() ?? ''
        const ticker = asset?.ticker.toLowerCase() ?? ''
        const note = tx.note?.toLowerCase() ?? ''
        if (!name.includes(kw) && !ticker.includes(kw) && !note.includes(kw)) return false
      }
      return true
    })
  }, [transactions, filters, assetMap])

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm())
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item: InvestmentTransaction) => {
    setEditItem(item)
    setForm({
      date: item.date,
      assetId: item.assetId,
      accountId: item.accountId,
      txType: item.txType,
      quantity: item.quantity,
      price: item.price,
      currency: item.currency,
      fxRateToBase: item.fxRateToBase,
      fee: item.fee,
      tax: item.tax,
      note: item.note ?? '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleCurrencyChange = (currency: InvestmentTransactionInput['currency']) => {
    setForm((prev) => ({
      ...prev,
      currency,
      fxRateToBase: currency === 'TWD' ? 1 : prev.fxRateToBase,
    }))
  }

  const handleSave = async () => {
    const result = InvestmentTransactionSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach((e) => { errs[String(e.path[0])] = e.message })
      setErrors(errs)
      return
    }
    if (editItem) {
      await investmentTxRepo.update(editItem.id, form)
    } else {
      await investmentTxRepo.add(form)
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (deleteId) {
      await investmentTxRepo.delete(deleteId)
      setDeleteId(null)
    }
  }

  const calcNetAmount = (tx: InvestmentTransaction) => {
    const gross = tx.quantity * tx.price
    if (tx.txType === 'buy' || tx.txType === 'deposit') {
      return -(gross + tx.fee + tx.tax)
    } else if (tx.txType === 'sell' || tx.txType === 'dividend' || tx.txType === 'withdrawal') {
      return gross - tx.fee - tx.tax
    }
    return -(tx.fee + tx.tax)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">投資交易紀錄</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary btn-sm ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : ''}`}
          >
            <Filter className="w-4 h-4" />
            篩選
          </button>
          <button onClick={openAdd} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            新增交易
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card mb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="form-group">
            <label className="label">日期起</label>
            <input type="date" className="input" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">日期迄</label>
            <input type="date" className="input" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={filters.currency} onChange={(e) => setFilters({ ...filters, currency: e.target.value })}>
              <option value="">全部</option>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">帳戶</label>
            <select className="select" value={filters.accountId} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}>
              <option value="">全部</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">市場</label>
            <select className="select" value={filters.market} onChange={(e) => setFilters({ ...filters, market: e.target.value })}>
              <option value="">全部</option>
              {Object.entries(MARKET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">資產類型</label>
            <select className="select" value={filters.assetType} onChange={(e) => setFilters({ ...filters, assetType: e.target.value })}>
              <option value="">全部</option>
              {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="label">關鍵字</label>
            <input className="input" placeholder="名稱、代號、備註" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters(emptyFilters())} className="btn-secondary btn-sm">清除篩選</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>日期</th>
              <th>標的</th>
              <th>市場/類型</th>
              <th>交易類型</th>
              <th>數量</th>
              <th>單價</th>
              <th>幣別</th>
              <th>手續費</th>
              <th>稅費</th>
              <th>淨額</th>
              <th>帳戶</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center text-gray-400 py-8">無交易紀錄</td>
              </tr>
            )}
            {filtered.map((tx) => {
              const asset = assetMap.get(tx.assetId)
              const account = accountMap.get(tx.accountId)
              const net = calcNetAmount(tx)
              return (
                <tr key={tx.id}>
                  <td>{formatDate(tx.date)}</td>
                  <td>
                    <div className="font-medium text-gray-900">{asset?.name ?? '-'}</div>
                    <div className="text-xs text-gray-400 font-mono">{asset?.ticker ?? '-'}</div>
                  </td>
                  <td>
                    <div className="text-xs">{MARKET_LABELS[asset?.market ?? 'TW'] ?? '-'}</div>
                    <div className="text-xs text-gray-400">{ASSET_TYPE_LABELS[asset?.assetType ?? 'tw_stock'] ?? '-'}</div>
                  </td>
                  <td>
                    <span className={TX_TYPE_BADGE_CLASS[tx.txType] ?? 'badge'}>
                      {INVESTMENT_TX_TYPE_LABELS[tx.txType]}
                    </span>
                  </td>
                  <td className="text-right font-mono">{formatNumber(tx.quantity, tx.quantity % 1 === 0 ? 0 : 4)}</td>
                  <td className="text-right font-mono">{formatNumber(tx.price, 2)}</td>
                  <td>{tx.currency}</td>
                  <td className="text-right text-sm text-gray-500">{formatNumber(tx.fee, 2)}</td>
                  <td className="text-right text-sm text-gray-500">{formatNumber(tx.tax, 2)}</td>
                  <td className={`text-right font-mono font-medium ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatNumber(net, 2)}
                  </td>
                  <td className="text-sm">{account?.name ?? '-'}</td>
                  <td className="text-xs text-gray-400">{tx.note || '-'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(tx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(tx.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? '編輯交易' : '新增交易'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">日期 *</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">交易類型 *</label>
            <select className="select" value={form.txType} onChange={(e) => setForm({ ...form, txType: e.target.value as InvestmentTransactionInput['txType'] })}>
              {INVESTMENT_TX_TYPES.map((t) => <option key={t} value={t}>{INVESTMENT_TX_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">資產 *</label>
            <select className="select" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
              <option value="">請選擇</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ticker})</option>)}
            </select>
            {errors.assetId && <span className="text-xs text-red-500">{errors.assetId}</span>}
          </div>
          <div className="form-group">
            <label className="label">帳戶 *</label>
            <select className="select" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">請選擇</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {errors.accountId && <span className="text-xs text-red-500">{errors.accountId}</span>}
          </div>
          <div className="form-group">
            <label className="label">數量</label>
            <input type="number" min="0" step="1" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">單價</label>
            <input type="number" min="0" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">幣別</label>
            <select className="select" value={form.currency} onChange={(e) => handleCurrencyChange(e.target.value as InvestmentTransactionInput['currency'])}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">匯率 (對 TWD)</label>
            <input type="number" min="0.0001" step="0.01" className="input" value={form.fxRateToBase} onChange={(e) => setForm({ ...form, fxRateToBase: Number(e.target.value) })} disabled={form.currency === 'TWD'} />
          </div>
          <div className="form-group">
            <label className="label">手續費</label>
            <input type="number" min="0" step="0.01" className="input" value={form.fee} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">稅費</label>
            <input type="number" min="0" step="0.01" className="input" value={form.tax} onChange={(e) => setForm({ ...form, tax: Number(e.target.value) })} />
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
        title="刪除交易"
        message="確定要刪除此交易紀錄嗎？"
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  )
}
