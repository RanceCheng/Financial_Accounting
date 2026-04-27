import { useState, useEffect } from 'react'
import { db } from '@/data/db'
import { assetRepo } from '@/data/repositories'
import { HoldingStats } from './HoldingStats'
import { TransactionList } from './TransactionList'
import { AssetManager } from './AssetManager'
import { AccountManager } from './AccountManager'
import { ExchangeRatePanel } from './ExchangeRatePanel'
import { ImportExportButtons } from '@/components/common/ImportExportButtons'

type Tab = 'transactions' | 'assets' | 'accounts'

export function InvestmentPage() {
  const [tab, setTab] = useState<Tab>('assets')
  const [txFilters, setTxFilters] = useState<import('./TransactionList').TxFilters | undefined>(undefined)

  // 一次性修正：將所有批次名稱統一為「{資產名} {買入日期}」
  useEffect(() => {
    ;(async () => {
      const assets = await db.assets.toArray()
      for (const asset of assets) {
        if (!asset.lots || asset.lots.length === 0) continue
        const p = (n: number) => String(n).padStart(2, '0')
        const updated = asset.lots.map(lot => {
          const d = new Date(lot.buyDate)
          const label = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
          return { ...lot, name: `${asset.name} ${label}` }
        })
        const hasChange = updated.some((u, i) => u.name !== asset.lots![i].name)
        if (hasChange) await assetRepo.update(asset.id, { lots: updated })
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs: { id: Tab; label: string; activeColor: string; inactiveColor: string }[] = [
    {
      id: 'assets',
      label: '資產管理',
      activeColor: 'bg-emerald-500 text-white border-emerald-500 shadow-sm',
      inactiveColor: 'bg-white text-emerald-600 border-emerald-300 hover:bg-emerald-50',
    },
    {
      id: 'accounts',
      label: '帳戶管理',
      activeColor: 'bg-blue-500 text-white border-blue-500 shadow-sm',
      inactiveColor: 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50',
    },
    {
      id: 'transactions',
      label: '交易紀錄',
      activeColor: 'bg-violet-500 text-white border-violet-500 shadow-sm',
      inactiveColor: 'bg-white text-violet-600 border-violet-300 hover:bg-violet-50',
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">投資紀錄表</h1>
          <p className="text-gray-500 text-sm mt-1">管理投資交易、資產與帳戶</p>
        </div>
        <ImportExportButtons />
      </div>

      <HoldingStats txFilters={txFilters} />

      <ExchangeRatePanel />

      {/* Tabs */}
      <div className="flex gap-3 mt-4 mb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg border-2 transition-all ${
              tab === t.id ? t.activeColor : t.inactiveColor
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'transactions' && <TransactionList onFiltersChange={(f) => setTxFilters(f)} />}
        {tab === 'assets' && <AssetManager />}
        {tab === 'accounts' && <AccountManager />}
      </div>
    </div>
  )
}
