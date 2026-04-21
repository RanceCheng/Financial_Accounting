import { Currency, CURRENCIES } from '@/lib/constants'

// 金額格式化
export function formatCurrency(
  amount: number,
  currency: Currency = 'TWD',
  options?: { compact?: boolean }
): string {
  const localeMap: Record<Currency, string> = {
    TWD: 'zh-TW',
    USD: 'en-US',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
  }

  if (options?.compact && Math.abs(amount) >= 10000) {
    const divided = amount / 10000
    return `${currency} ${divided.toFixed(2)}萬`
  }

  return new Intl.NumberFormat(localeMap[currency] || 'zh-TW', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
}

export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function formatDatetime(isoStr: string): string {
  if (!isoStr) return '-'
  try {
    return new Date(isoStr).toLocaleString('zh-TW')
  } catch {
    return isoStr
  }
}

export function isCurrency(value: string): value is Currency {
  return CURRENCIES.includes(value as Currency)
}

export function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}年${Number(month)}月`
}
