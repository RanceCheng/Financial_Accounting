import React from 'react'

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  colorClass?: string
  icon?: React.ReactNode
}

export function StatCard({ label, value, subValue, colorClass = 'text-gray-900', icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</div>
      {subValue && <div className="text-sm text-gray-400 mt-0.5">{subValue}</div>}
    </div>
  )
}
