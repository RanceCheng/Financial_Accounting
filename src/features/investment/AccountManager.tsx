import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { Account } from '@/data/types'
import { accountRepo, accountTransferRepo } from '@/data/repositories'
import { AccountSchema, AccountInput } from '@/data/schemas'
import { ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_LABELS } from '@/lib/constants'
import { formatCurrency, formatNumber, formatDatetime } from '@/lib/formatters'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SortTh } from '@/components/common/SortTh'
import { useSortable, sortByKey } from '@/lib/sorting'
import { Plus, Edit2, Trash2, ArrowRightLeft } from 'lucide-react'

const emptyForm = (): AccountInput => ({
  name: '',
  type: 'brokerage',
  currency: 'TWD',
  balance: 0,
  note: '',
})

interface TransferForm {
  date: string
  fromAccountId: string
  toAccountId: string
  fromAmount: number
  exchangeRate: number
  fee: number
  note: string
}

const toDatetimeLocal = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const emptyTransferForm = (): TransferForm => ({
  date: toDatetimeLocal(new Date()),
  fromAccountId: '',
  toAccountId: '',
  fromAmount: 0,
  exchangeRate: 1,
  fee: 0,
  note: '',
})

function calcExRate(fromCur: string, toCur: string, er: { usdRate: number; jpyRate: number; cnyRate: number } | undefined): number {
  if (!er || fromCur === toCur) return 1
  // toTWD: 將任意幣別换算為 TWD（新格式： usdRate = 1 USD = X TWD，直接使用）
  const toTWD = (c: string) => {
    if (c === 'TWD') return 1
    if (c === 'USD' && er.usdRate > 0) return er.usdRate
    if (c === 'JPY' && er.jpyRate > 0) return er.jpyRate
    if (c === 'CNY' && er.cnyRate > 0) return er.cnyRate
    return 1
  }
  // fromTWD: 將 TWD 换算為任意幣別（反向）
  const fromTWD = (c: string) => {
    if (c === 'TWD') return 1
    if (c === 'USD' && er.usdRate > 0) return 1 / er.usdRate
    if (c === 'JPY' && er.jpyRate > 0) return 1 / er.jpyRate
    if (c === 'CNY' && er.cnyRate > 0) return 1 / er.cnyRate
    return 1
  }
  return toTWD(fromCur) * fromTWD(toCur)
}

export function AccountManager() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const transfers = useLiveQuery(() => db.accountTransfers.orderBy('date').reverse().toArray(), []) ?? []
  const exchangeRate = useLiveQuery(() => db.exchangeRates.get('current'), [])

  const { sortKey, sortDir, handleSort } = useSortable('name')
  const sorted = useMemo(() => sortByKey(accounts, sortKey, sortDir, (a, key) => {
    switch (key) {
      case 'name': return a.name
      case 'type': return ACCOUNT_TYPE_LABELS[a.type]
      case 'currency': return a.currency
      case 'balance': return a.balance ?? 0
      default: return ''
    }
  }), [accounts, sortKey, sortDir])

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Account | null>(null)
  const [form, setForm] = useState<AccountInput>(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 轉帳狀態
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferForm, setTransferForm] = useState<TransferForm>(emptyTransferForm())
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({})
  const [deleteTransferId, setDeleteTransferId] = useState<string | null>(null)
  const [overdraftConfirmOpen, setOverdraftConfirmOpen] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<Parameters<typeof accountTransferRepo.add>[0] | null>(null)

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  const fromAccount = accountMap.get(transferForm.fromAccountId)
  const toAccount = accountMap.get(transferForm.toAccountId)
  const toAmount = transferForm.fromAmount * transferForm.exchangeRate

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm())
    setErrors({})
    setModalOpen(true)
  }

  const openTransfer = () => {
    setTransferForm({ ...emptyTransferForm(), date: toDatetimeLocal(new Date()) })
    setTransferErrors({})
    setTransferOpen(true)
  }

  const handleFromAccountChange = (id: string) => {
    const fromAcc = accountMap.get(id)
    const toAcc = accountMap.get(transferForm.toAccountId)
    const rate = fromAcc && toAcc ? calcExRate(fromAcc.currency, toAcc.currency, exchangeRate) : 1
    setTransferForm(prev => ({ ...prev, fromAccountId: id, exchangeRate: rate }))
  }

  const handleToAccountChange = (id: string) => {
    const fromAcc = accountMap.get(transferForm.fromAccountId)
    const toAcc = accountMap.get(id)
    const rate = fromAcc && toAcc ? calcExRate(fromAcc.currency, toAcc.currency, exchangeRate) : 1
    setTransferForm(prev => ({ ...prev, toAccountId: id, exchangeRate: rate }))
  }

  const executeTransfer = async (payload: Parameters<typeof accountTransferRepo.add>[0]) => {
    await accountRepo.update(payload.fromAccountId, { balance: payload.fromBalanceAfter })
    await accountRepo.update(payload.toAccountId, { balance: payload.toBalanceAfter })
    await accountTransferRepo.add(payload)
    setTransferOpen(false)
    setPendingTransfer(null)
  }

  const handleTransferSave = async () => {
    const errs: Record<string, string> = {}
    if (!transferForm.fromAccountId) errs.fromAccountId = '請選擇轉出帳戶'
    if (!transferForm.toAccountId) errs.toAccountId = '請選擇轉入帳戶'
    if (transferForm.fromAccountId && transferForm.fromAccountId === transferForm.toAccountId) errs.toAccountId = '轉出與轉入帳戶不能相同'
    if (transferForm.fromAmount <= 0) errs.fromAmount = '轉出金額必須大於 0'
    if (Object.keys(errs).length > 0) { setTransferErrors(errs); return }

    const from = accountMap.get(transferForm.fromAccountId)!
    const to = accountMap.get(transferForm.toAccountId)!
    const tAmt = transferForm.fromAmount * transferForm.exchangeRate
    const fromBalAfter = (from.balance ?? 0) - transferForm.fromAmount - transferForm.fee
    const toBalAfter = (to.balance ?? 0) + tAmt

    const payload = {
      date: new Date(transferForm.date).toISOString(),
      fromAccountId: from.id,
      toAccountId: to.id,
      fromCurrency: from.currency,
      toCurrency: to.currency,
      fromAmount: transferForm.fromAmount,
      toAmount: tAmt,
      exchangeRate: transferForm.exchangeRate,
      fee: transferForm.fee,
      fromBalanceAfter: fromBalAfter,
      toBalanceAfter: toBalAfter,
      note: transferForm.note,
    }

    if (fromBalAfter < 0) {
      setPendingTransfer(payload)
      setOverdraftConfirmOpen(true)
      return
    }

    await executeTransfer(payload)
  }

  const handleDeleteTransfer = async () => {
    if (deleteTransferId) {
      await accountTransferRepo.delete(deleteTransferId)
      setDeleteTransferId(null)
    }
  }

  const openEdit = (item: Account) => {
    setEditItem(item)
    setForm({ name: item.name, type: item.type, currency: item.currency, balance: item.balance ?? 0, note: item.note ?? '' })
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
    // 重複名稱檢查（相同名稱 + 相同幣別才算重複）
    const duplicate = accounts.find(
      (a) => a.name.trim() === form.name.trim() && a.currency === form.currency && a.id !== editItem?.id
    )
    if (duplicate) {
      setErrors({ name: '已存在相同名稱且幣別相同的帳戶' })
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
        <div className="flex gap-2">
          <button onClick={openTransfer} className="btn-secondary btn-sm">
            <ArrowRightLeft className="w-4 h-4" />
            轉帳
          </button>
          <button onClick={openAdd} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            新增帳戶
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <SortTh label="帳戶名稱" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="類型" sortKey="type" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="幣別" sortKey="currency" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="現有資金" sortKey="balance" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8">尚無帳戶</td>
              </tr>
            )}
            {sorted.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.name}</td>
                <td>{ACCOUNT_TYPE_LABELS[a.type]}</td>
                <td>{a.currency}</td>
                <td className={`text-right font-mono ${ (a.balance ?? 0) < 0 ? '!text-green-600' : '' }`}>{formatCurrency(a.balance ?? 0, a.currency)}</td>
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
            <label className="label">現有資金</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
            {errors.balance && <span className="text-xs text-red-500">{errors.balance}</span>}
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

      {/* 轉帳 Modal */}
      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title="帳戶轉帳">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label className="label">日期 *</label>
            <input
              type="datetime-local"
              step="1"
              className="input"
              value={transferForm.date}
              onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="label">轉出帳戶 *</label>
            <select
              className="select"
              value={transferForm.fromAccountId}
              onChange={(e) => handleFromAccountChange(e.target.value)}
            >
              <option value="">請選擇</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
            {transferErrors.fromAccountId && <span className="text-xs text-red-500">{transferErrors.fromAccountId}</span>}
          </div>
          <div className="form-group">
            <label className="label">轉入帳戶 *</label>
            <select
              className="select"
              value={transferForm.toAccountId}
              onChange={(e) => handleToAccountChange(e.target.value)}
            >
              <option value="">請選擇</option>
              {accounts.filter(a => a.id !== transferForm.fromAccountId).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
            {transferErrors.toAccountId && <span className="text-xs text-red-500">{transferErrors.toAccountId}</span>}
          </div>
          <div className="form-group">
            <label className="label">轉出金額 *</label>
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              value={transferForm.fromAmount || ''}
              onChange={(e) => setTransferForm({ ...transferForm, fromAmount: parseFloat(e.target.value) || 0 })}
            />
            {transferErrors.fromAmount && <span className="text-xs text-red-500">{transferErrors.fromAmount}</span>}
          </div>
          <div className="form-group">
            <label className="label">
              匯率（1 {fromAccount?.currency ?? '轉出'} = X {toAccount?.currency ?? '轉入'}）
            </label>
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              value={transferForm.exchangeRate}
              onChange={(e) => setTransferForm({ ...transferForm, exchangeRate: parseFloat(e.target.value) || 1 })}
            />
          </div>
          <div className="form-group">
            <label className="label">轉入金額（自動計算）</label>
            <input
              type="number"
              className="input bg-gray-50"
              readOnly
              value={toAmount.toFixed(4)}
            />
          </div>
          <div className="form-group">
            <label className="label">手續費（{fromAccount?.currency ?? '轉出幣別'}）</label>
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              value={transferForm.fee || ''}
              onChange={(e) => setTransferForm({ ...transferForm, fee: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="form-group col-span-2">
            <label className="label">備註</label>
            <input
              className="input"
              value={transferForm.note}
              onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
            />
          </div>
          {fromAccount && (
            <div className="col-span-2 text-sm text-gray-500">
              轉出後餘額：{formatNumber((fromAccount.balance ?? 0) - transferForm.fromAmount - transferForm.fee)} {fromAccount.currency}
              ，轉入後餘額：{formatNumber((toAccount?.balance ?? 0) + toAmount)} {toAccount?.currency ?? ''}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setTransferOpen(false)} className="btn-secondary">取消</button>
          <button onClick={handleTransferSave} className="btn-primary">確認轉帳</button>
        </div>
      </Modal>

      {/* 轉帳紀錄 */}
      <div className="mt-8">
        <h4 className="font-semibold text-gray-700 mb-3">轉帳紀錄</h4>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>轉出帳戶</th>
                <th>轉入帳戶</th>
                <th>轉出幣別</th>
                <th className="text-right">轉出金額</th>
                <th className="text-right">轉入當下匯率</th>
                <th className="text-right">手續費</th>
                <th className="text-right">轉出帳戶餘額</th>
                <th className="text-right">轉入帳戶餘額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-gray-400 py-6">尚無轉帳紀錄</td>
                </tr>
              )}
              {transfers.map(t => (
                <tr key={t.id}>
                  <td className="text-sm">{formatDatetime(t.date)}</td>
                  <td>{accountMap.get(t.fromAccountId)?.name ?? t.fromAccountId}</td>
                  <td>{accountMap.get(t.toAccountId)?.name ?? t.toAccountId}</td>
                  <td>{t.fromCurrency}</td>
                  <td className="text-right font-mono">{formatNumber(t.fromAmount)}</td>
                  <td className="text-right font-mono">{t.exchangeRate.toFixed(6)}</td>
                  <td className="text-right font-mono">{formatNumber(t.fee)}</td>
                  <td className="text-right font-mono">{formatNumber(t.fromBalanceAfter)}</td>
                  <td className="text-right font-mono">{formatNumber(t.toBalanceAfter)}</td>
                  <td>
                    <button onClick={() => setDeleteTransferId(t.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTransferId}
        title="刪除轉帳紀錄"
        message="確定要刪除此筆轉帳紀錄嗎？（不會回復帳戶餘額）"
        confirmLabel="刪除"
        onConfirm={handleDeleteTransfer}
        onCancel={() => setDeleteTransferId(null)}
        danger
      />

      <ConfirmDialog
        isOpen={overdraftConfirmOpen}
        title="餘額不足警告"
        message={`轉帳後「${fromAccount?.name ?? '轉出帳戶'}」餘額將為 ${pendingTransfer ? formatNumber(pendingTransfer.fromBalanceAfter) : ''}（低於 0），確定仍要繼續轉帳嗎？`}
        confirmLabel="仍要轉帳"
        onConfirm={async () => {
          setOverdraftConfirmOpen(false)
          if (pendingTransfer) await executeTransfer(pendingTransfer)
        }}
        onCancel={() => { setOverdraftConfirmOpen(false); setPendingTransfer(null) }}
        danger
      />
    </div>
  )
}
