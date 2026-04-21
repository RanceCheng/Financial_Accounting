import { Routes, Route, Navigate } from 'react-router-dom'
import { InvestmentPage } from '@/features/investment/InvestmentPage'
import { RebalancePage } from '@/features/rebalance/RebalancePage'
import { CashflowPage } from '@/features/cashflow/CashflowPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/investment" replace />} />
      <Route path="/investment" element={<InvestmentPage />} />
      <Route path="/rebalance" element={<RebalancePage />} />
      <Route path="/cashflow" element={<CashflowPage />} />
      <Route path="*" element={<Navigate to="/investment" replace />} />
    </Routes>
  )
}
