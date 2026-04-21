import { exportAppData, downloadJson } from '@/data/services/importExport'
import { importAppData } from '@/data/services/importExport'
import { Download, Upload } from 'lucide-react'

interface ImportExportButtonsProps {
  onImportSuccess?: () => void
}

export function ImportExportButtons({ onImportSuccess }: ImportExportButtonsProps) {
  const handleExport = async () => {
    try {
      const data = await exportAppData()
      downloadJson(data)
    } catch (err) {
      alert(`匯出失敗：${err}`)
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const result = await importAppData(text)
      if (result.valid) {
        alert('匯入成功！頁面將重新整理。')
        onImportSuccess?.()
        window.location.reload()
      } else {
        alert(`匯入失敗：\n${result.errors.join('\n')}`)
      }
    }
    document.body.appendChild(input)
    input.click()
    document.body.removeChild(input)
  }

  return (
    <div className="flex gap-2">
      <button onClick={handleImport} className="btn-secondary btn-sm">
        <Upload className="w-4 h-4" />
        匯入 JSON
      </button>
      <button onClick={handleExport} className="btn-secondary btn-sm">
        <Download className="w-4 h-4" />
        匯出 JSON
      </button>
    </div>
  )
}
