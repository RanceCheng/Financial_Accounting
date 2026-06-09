import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { assetRepo } from '@/data/repositories'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { reconcileAssetsFromTransactions, ReconcileResult } from '@/data/services/reconcileTransactions'
import { ClipboardCheck, CheckCircle, AlertTriangle, X, Trash2 } from 'lucide-react'

// 共用「更新交易紀錄」按鈕：依交易紀錄（買入/賣出 FIFO）重建資產數量，確保兩者一致
export function ReconcileTransactionsButton() {
  const assets = useLiveQuery(() => db.assets.toArray(), [])
  const transactions = useLiveQuery(() => db.investmentTransactions.toArray(), [])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ReconcileResult[] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReconcileResult | null>(null)

  const preview = useMemo(
    () => reconcileAssetsFromTransactions(assets ?? [], transactions ?? []),
    [assets, transactions]
  )
  const updatedCount = preview.filter(r => r.status === 'updated').length
  const needsReviewCount = preview.filter(r => r.status === 'needsReview').length

  const handleConfirm = async () => {
    setRunning(true)
    try {
      for (const r of preview) {
        if (r.status === 'updated' && r.patch) {
          await assetRepo.update(r.assetId, r.patch)
        }
      }
      setResults(preview)
    } finally {
      setRunning(false)
      setConfirmOpen(false)
    }
  }

  // 逐筆刪除：有持有但無買入紀錄的資產，由使用者確認後才刪除
  const handleDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.assetId
    await assetRepo.delete(id)
    setResults(prev => (prev ? prev.filter(r => r.assetId !== id) : prev))
    setDeleteTarget(null)
  }

  const updated = (results ?? []).filter(r => r.status === 'updated')
  const needsReview = (results ?? []).filter(r => r.status === 'needsReview')
  const skipped = (results ?? []).filter(r => r.status === 'skipped')
  const unchanged = (results ?? []).filter(r => r.status === 'unchanged')
  const fmtQty = (v?: number) => (v == null ? '0' : v.toLocaleString('zh-TW', { maximumFractionDigits: 4 }))

  return (
    <>
      <button
        onClick={() => { setResults(null); setConfirmOpen(true) }}
        className="btn-secondary btn-sm flex items-center gap-1.5"
        title="依交易紀錄重新核對資產數量"
      >
        <ClipboardCheck className="w-4 h-4" />
        更新交易紀錄
      </button>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="更新交易紀錄"
        message={
          [
            updatedCount > 0 ? `將依交易紀錄（買入/賣出）重新核對資產數量，預計修正 ${updatedCount} 筆資產。` : '',
            needsReviewCount > 0 ? `另有 ${needsReviewCount} 筆資產有持有數量但無買入紀錄，將列出供您確認是否刪除（不會自動刪除或清空）。` : '',
          ].filter(Boolean).join('') || '所有資產的數量與交易紀錄一致，無需更新。仍要重新核對嗎？'
        }
        confirmLabel={running ? '處理中…' : '開始核對'}
        cancelLabel="取消"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        danger={updatedCount > 0}
      />

      {results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                交易紀錄核對完成
              </h3>
              <button onClick={() => setResults(null)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 text-sm text-gray-600 border-b flex flex-wrap gap-x-4 gap-y-1">
              <span>已修正 <b className="text-red-600">{updated.length}</b> 筆</span>
              <span>一致 <b className="text-gray-700">{unchanged.length}</b> 筆</span>
              {needsReview.length > 0 && <span>待確認 <b className="text-amber-600">{needsReview.length}</b> 筆</span>}
              <span>略過 <b className="text-gray-400">{skipped.length}</b> 筆</span>
            </div>

            <div className="overflow-y-auto px-5 py-3 space-y-4">
              {/* 有持有但無買入紀錄：不自動刪除，交由使用者確認 */}
              {needsReview.length > 0 && (
                <div>
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>以下資產有持有數量，但交易紀錄沒有對應的買入紀錄。系統不會自動更動或刪除，請逐筆確認是否刪除。</span>
                  </div>
                  <div className="space-y-2">
                    {needsReview.map(r => (
                      <div key={r.assetId} className="flex items-center justify-between gap-2 text-sm border border-amber-200 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{r.name}</p>
                          <p className="text-xs text-gray-400">
                            {r.ticker || '—'}　持有 {fmtQty(r.beforeQty)}　買入 {r.buyCount} / 賣出 {r.sellCount} 筆
                          </p>
                        </div>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="btn-danger btn-sm flex items-center gap-1 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          刪除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 已依交易修正數量 */}
              {updated.length > 0 && (
                <div className="space-y-2">
                  {updated.map(r => (
                    <div key={r.assetId} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{r.name}</p>
                        <p className="text-xs text-gray-400">
                          {r.ticker || '—'}　買入 {r.buyCount} / 賣出 {r.sellCount} 筆
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-right shrink-0">
                        <span className="text-gray-400 line-through">{fmtQty(r.beforeQty)}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold text-gray-900">{fmtQty(r.afterQty)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {updated.length === 0 && needsReview.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center">所有資產數量皆與交易紀錄一致，未變更任何資料。</p>
              )}
            </div>

            <div className="px-5 py-3 border-t flex justify-end">
              <button onClick={() => setResults(null)} className="btn-primary btn-sm">關閉</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="刪除資產"
        message={
          deleteTarget
            ? `確定要刪除資產「${deleteTarget.name}」嗎？此資產目前持有 ${fmtQty(deleteTarget.beforeQty)}，但交易紀錄沒有任何買入紀錄。刪除後將無法復原。`
            : ''
        }
        confirmLabel="刪除"
        cancelLabel="取消"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </>
  )
}
