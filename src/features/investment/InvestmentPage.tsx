import { useState } from 'react'
import { HoldingStats } from './HoldingStats'
import { TransactionList } from './TransactionList'
import { AssetManager } from './AssetManager'
import { AccountManager } from './AccountManager'
import { ImportExportButtons } from '@/components/common/ImportExportButtons'

type Tab = 'transactions' | 'assets' | 'accounts'

export function InvestmentPage() {
  const [tab, setTab] = useState<Tab>('transactions')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'transactions', label: '交易紀錄' },
    { id: 'assets', label: '資產管理' },
    { id: 'accounts', label: '帳戶管理' },
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

      <HoldingStats />

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="card">
        {tab === 'transactions' && <TransactionList />}
        {tab === 'assets' && <AssetManager />}
        {tab === 'accounts' && <AccountManager />}
      </div>
    </div>
  )
}
