import { exportAppData, downloadJson } from '@/data/services/importExport'

const BACKUP_HISTORY_KEY = 'fa_backup_history'
const LAST_BACKUP_KEY = 'fa_last_backup_at'

export interface BackupRecord {
  id: string
  label: string
  backedAt: string   // ISO
  size: number       // bytes（JSON 字串長度）
}

// 最多保留幾筆歷史標籤
const MAX_HISTORY = 20

// ── 讀取歷史清單（僅 metadata，不含資料本身）──
export function getBackupHistory(): BackupRecord[] {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY)
    return raw ? (JSON.parse(raw) as BackupRecord[]) : []
  } catch {
    return []
  }
}

// ── 上次備份時間 ──
export function getLastBackupAt(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY)
}

// ── 距上次備份天數（null = 從未備份）──
export function daysSinceLastBackup(): number | null {
  const last = getLastBackupAt()
  if (!last) return null
  const diffMs = Date.now() - new Date(last).getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// ── 執行備份：匯出 JSON 並下載，記錄 metadata ──
export async function performBackup(label?: string): Promise<BackupRecord> {
  const data = await exportAppData()
  const json = JSON.stringify(data, null, 2)
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '')
  const defaultLabel = `備份_${dateStr}_${timeStr}`
  const finalLabel = (label?.trim() || defaultLabel)

  // 下載檔案
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financial_accounting_${dateStr}_${timeStr}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  // 記錄 metadata
  const record: BackupRecord = {
    id: `${now.getTime()}`,
    label: finalLabel,
    backedAt: now.toISOString(),
    size: json.length,
  }

  const history = getBackupHistory()
  history.unshift(record)
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  localStorage.setItem(LAST_BACKUP_KEY, now.toISOString())

  return record
}

// ── 匯出但不計入備份歷史（原始功能） ──
export { exportAppData, downloadJson }
