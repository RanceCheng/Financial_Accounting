import { useState, useCallback } from 'react'
import {
  ShieldCheck, AlertTriangle, AlertCircle, Info,
  Download, History, Clock, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react'
import { runHealthCheck, HealthReport, HealthIssue, HealthSeverity } from '@/data/services/healthCheck'
import {
  performBackup, getBackupHistory, daysSinceLastBackup, BackupRecord,
} from '@/data/services/backup'
import { importAppData } from '@/data/services/importExport'
import { Upload } from 'lucide-react'

// ── 嚴重度樣式 ──
const SEVERITY_STYLES: Record<HealthSeverity, { icon: typeof AlertCircle; badge: string; row: string }> = {
  error: { icon: AlertCircle, badge: 'bg-red-100 text-red-700 border border-red-300', row: 'bg-red-50' },
  warning: { icon: AlertTriangle, badge: 'bg-yellow-100 text-yellow-700 border border-yellow-300', row: 'bg-yellow-50' },
  info: { icon: Info, badge: 'bg-blue-100 text-blue-700 border border-blue-300', row: 'bg-blue-50' },
}

const SEVERITY_LABELS: Record<HealthSeverity, string> = { error: '錯誤', warning: '警告', info: '資訊' }

// ============================================================
// 健康檢查卡片
// ============================================================

function HealthCheckPanel() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<HealthSeverity | 'all'>('all')

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const r = await runHealthCheck()
      setReport(r)
      setFilterSeverity('all')
    } finally {
      setLoading(false)
    }
  }, [])

  const filtered: HealthIssue[] = report
    ? (filterSeverity === 'all' ? report.issues : report.issues.filter(i => i.severity === filterSeverity))
    : []

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">資料健康檢查</h2>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary btn-sm flex items-center gap-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '檢查中…' : '執行檢查'}
        </button>
      </div>

      {!report && !loading && (
        <p className="text-sm text-slate-500">點擊「執行檢查」掃描資料庫完整性與異常值。</p>
      )}

      {report && (
        <>
          {/* 統計摘要 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                { label: '帳戶', value: report.stats.accounts },
                { label: '資產', value: report.stats.assets },
                { label: '投資交易', value: report.stats.investmentTx },
                { label: '收支記錄', value: report.stats.incomeExpenseRecords },
              ] as { label: string; value: number }[]
            ).map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-slate-700">{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* 問題計數 */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'error', 'warning', 'info'] as const).map(s => {
              const count = s === 'all' ? report.counts.total : report.counts[s]
              const active = filterSeverity === s
              return (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(s)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    active ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {s === 'all' ? `全部 (${count})` : `${SEVERITY_LABELS[s]} (${count})`}
                </button>
              )
            })}
          </div>

          {/* 全部正常 */}
          {report.counts.total === 0 && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span className="font-medium">所有資料檢查通過，無問題！</span>
            </div>
          )}

          {/* 問題列表 */}
          {filtered.length > 0 && (
            <div className="space-y-1.5">
              {filtered.map(issue => {
                const cfg = SEVERITY_STYLES[issue.severity]
                const Icon = cfg.icon
                const expanded = expandedId === issue.id
                return (
                  <div key={issue.id} className={`rounded-lg border border-slate-200 overflow-hidden ${cfg.row}`}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:brightness-95 transition-all"
                      onClick={() => setExpandedId(expanded ? null : issue.id)}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                        {issue.category}
                      </span>
                      <span className="flex-1 text-sm">{issue.message}</span>
                      {issue.detail && (expanded ? <ChevronUp className="w-4 h-4 shrink-0 text-slate-400" /> : <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />)}
                    </button>
                    {expanded && issue.detail && (
                      <div className="px-10 pb-2.5 text-xs text-slate-600 font-mono">{issue.detail}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-slate-400">
            上次檢查：{new Date(report.checkedAt).toLocaleString('zh-TW')}
          </p>
        </>
      )}
    </section>
  )
}

// ============================================================
// 備份強化卡片
// ============================================================

function BackupPanel() {
  const [history, setHistory] = useState<BackupRecord[]>(() => getBackupHistory())
  const [backing, setBacking] = useState(false)
  const [label, setLabel] = useState('')
  const [importing, setImporting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const days = daysSinceLastBackup()
  const warnBackup = days === null || days >= 30

  const doBackup = async () => {
    setBacking(true)
    try {
      await performBackup(label)
      setHistory(getBackupHistory())
      setLabel('')
    } catch (err) {
      alert(`備份失敗：${err}`)
    } finally {
      setBacking(false)
    }
  }

  const doImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setImporting(true)
      try {
        const text = await file.text()
        const result = await importAppData(text)
        if (result.valid) {
          alert('匯入成功！頁面將重新整理。')
          window.location.reload()
        } else {
          alert(`匯入失敗：\n${result.errors.join('\n')}`)
        }
      } finally {
        setImporting(false)
      }
    }
    document.body.appendChild(input)
    input.click()
    document.body.removeChild(input)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <section className="card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Download className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-semibold">備份強化</h2>
      </div>

      {/* 備份提醒 */}
      {warnBackup && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 border ${days === null ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
          <Clock className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            {days === null ? '尚未備份過，建議立即建立第一份備份！' : `距上次備份已 ${days} 天，建議定期備份以確保資料安全。`}
          </span>
        </div>
      )}

      {!warnBackup && days !== null && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3 border bg-green-50 border-green-200 text-green-700">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span className="text-sm">上次備份：{days === 0 ? '今天' : `${days} 天前`}</span>
        </div>
      )}

      {/* 備份操作 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">備份標籤（選填）</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="例：出國前備份、2025 年底"
          className="input w-full"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={doBackup} disabled={backing} className="btn-primary btn-sm flex items-center gap-1.5">
            <Download className={`w-4 h-4 ${backing ? 'animate-bounce' : ''}`} />
            {backing ? '備份中…' : '立即備份 (下載 JSON)'}
          </button>
          <button onClick={doImport} disabled={importing} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Upload className="w-4 h-4" />
            {importing ? '匯入中…' : '從備份還原'}
          </button>
        </div>
      </div>

      {/* 備份歷史 */}
      <div>
        <button
          onClick={() => setShowHistory(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          <History className="w-4 h-4" />
          備份歷史紀錄 ({history.length})
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHistory && (
          <div className="mt-3 space-y-1.5">
            {history.length === 0 && (
              <p className="text-sm text-slate-400">尚無備份紀錄。</p>
            )}
            {history.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-700">{rec.label}</span>
                  <span className="ml-2 text-slate-400 text-xs">{new Date(rec.backedAt).toLocaleString('zh-TW')}</span>
                </div>
                <span className="text-slate-400 text-xs">{formatSize(rec.size)}</span>
              </div>
            ))}
            {history.length > 0 && (
              <p className="text-xs text-slate-400">歷史紀錄為本機瀏覽器快取（最多保留 20 筆），不含資料本身。</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ============================================================
// 頁面主體
// ============================================================

export function DataToolsPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">資料工具</h1>
        <p className="text-sm text-slate-500 mt-1">健康檢查與備份管理</p>
      </div>
      <HealthCheckPanel />
      <BackupPanel />
    </div>
  )
}
