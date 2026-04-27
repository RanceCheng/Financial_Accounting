import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSortable(defaultKey: string, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return { sortKey, sortDir, handleSort }
}

export function sortByKey<T>(
  items: T[],
  key: string,
  dir: SortDir,
  getValue: (item: T, key: string) => string | number | undefined
): T[] {
  return [...items].sort((a, b) => {
    const av = getValue(a, key) ?? ''
    const bv = getValue(b, key) ?? ''
    let cmp = 0
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), 'zh-TW', { numeric: true })
    }
    return dir === 'asc' ? cmp : -cmp
  })
}
