import React from 'react'

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  colorClass?: string
  icon?: React.ReactNode
  onClick?: () => void
}

export function StatCard({ label, value, subValue, colorClass = 'text-gray-900', icon, onClick }: StatCardProps) {
  return (
    <div
      className={`stat-card ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</div>
      {subValue && <div className="text-sm text-gray-400 mt-0.5">{subValue}</div>}
    </div>
  )
}
