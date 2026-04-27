import React from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface SortThProps {
  label: React.ReactNode
  sortKey: string
  current: string
  dir: 'asc' | 'desc'
  onSort: (key: string) => void
  className?: string
}

export function SortTh({ label, sortKey, current, dir, onSort, className = '' }: SortThProps) {
  const active = current === sortKey
  return (
    <th
      className={`cursor-pointer select-none ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-500 shrink-0" />
            : <ChevronDown className="w-3 h-3 text-blue-500 shrink-0" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 text-gray-300 shrink-0" />
        )}
      </span>
    </th>
  )
}
