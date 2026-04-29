import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  TrendingUp,
  PieChart,
  DollarSign,
  Menu,
  X,
  BarChart2,
  ShieldCheck,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

const navItems = [
  {
    path: '/investment',
    label: '投資紀錄表',
    icon: TrendingUp,
  },
  {
    path: '/rebalance',
    label: '資產再平衡表',
    icon: PieChart,
  },
  {
    path: '/cashflow',
    label: '收入與消費表',
    icon: DollarSign,
  },
  {
    path: '/data-tools',
    label: '資料工具',
    icon: ShieldCheck,
  },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 bg-slate-900 text-white transition-all duration-300
          ${sidebarOpen ? 'w-64' : 'w-0 lg:w-16'}
          overflow-hidden
        `}
      >
        <div className="flex flex-col h-full min-w-64 lg:min-w-0">
          {/* Logo area */}
          <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
            <BarChart2 className="w-7 h-7 text-blue-400 shrink-0" />
            <span
              className={`font-bold text-lg transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'}`}
            >
              財務管理
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = location.pathname.startsWith(item.path)
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium
                    ${active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className={`text-sm whitespace-nowrap transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'}`}>
                    {item.label}
                  </span>
                </NavLink>
              )
            })}
          </nav>

          {/* Version */}
          <div className={`px-4 py-3 text-xs text-slate-500 border-t border-slate-700 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
            v1.0.0 · 離線優先
          </div>
        </div>
      </aside>
    </>
  )
}

export function TopBar() {
  const { toggleSidebar, sidebarOpen } = useUIStore()

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-4 shadow-sm">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        aria-label="切換側邊欄"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      <span className="font-semibold text-gray-800">Financial Accounting</span>
    </header>
  )
}

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarOpen } = useUIStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div
        className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}
      >
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
