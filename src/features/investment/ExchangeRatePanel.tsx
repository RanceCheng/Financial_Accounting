import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { exchangeRateRepo } from '@/data/repositories'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

const EXCHANGE_API_URL = 'https://open.er-api.com/v6/latest/TWD'

function formatRate(rate: number, decimals = 6): string {
  return rate.toFixed(decimals)
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function ExchangeRatePanel() {
  const rate = useLiveQuery(() => db.exchangeRates.get('current'), [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRefresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(EXCHANGE_API_URL, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.result !== 'success') throw new Error('API 回傳失敗')
      await exchangeRateRepo.save({
        updatedAt: new Date().toISOString(),
        usdRate: data.rates?.USD ?? 0,
        jpyRate: data.rates?.JPY ?? 0,
        cnyRate: data.rates?.CNY ?? 0,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '網路連線失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <span>匯率參考</span>
          {rate
            ? <WifiOff className="w-4 h-4 text-gray-400" />
            : <WifiOff className="w-4 h-4 text-gray-300" />}
        </h3>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="btn-secondary btn-sm flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '更新中...' : '更新即時匯率'}
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-center gap-2">
          <Wifi className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {rate ? (
        <div className="table-container">
          <table className="table border border-gray-200 border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 border-r border-gray-200">更新日期</th>
                <th className="text-right px-4 py-3 border-r border-gray-200">USD 兌換 TWD<span className="text-xs font-normal text-gray-400 ml-1">（1 USD = X TWD）</span></th>
                <th className="text-right px-4 py-3 border-r border-gray-200">JPY 兌換 TWD<span className="text-xs font-normal text-gray-400 ml-1">（1 JPY = X TWD）</span></th>
                <th className="text-right px-4 py-3">CNY 兌換 TWD<span className="text-xs font-normal text-gray-400 ml-1">（1 CNY = X TWD）</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-left text-gray-500 text-sm px-4 py-3 border-r border-gray-200">{formatDatetime(rate.updatedAt)}</td>
                <td className="text-right font-mono font-medium text-blue-700 px-4 py-3 border-r border-gray-200">{rate.usdRate > 0 ? formatRate(1 / rate.usdRate, 4) : '—'}</td>
                <td className="text-right font-mono font-medium text-blue-700 px-4 py-3 border-r border-gray-200">{rate.jpyRate > 0 ? formatRate(1 / rate.jpyRate, 4) : '—'}</td>
                <td className="text-right font-mono font-medium text-blue-700 px-4 py-3">{rate.cnyRate > 0 ? formatRate(1 / rate.cnyRate, 4) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          尚無匯率資料，請點擊「更新即時匯率」取得最新資料
        </div>
      )}
    </div>
  )
}
