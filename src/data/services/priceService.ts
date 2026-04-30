// ============================================================
// 股價取得服務（共用）
// ============================================================

// 偵測是否以 file:// 協定開啟（靜態網頁雙擊模式）
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:'
const FILE_PROXY_BASE = 'http://localhost:8080'
let localProxyReadyPromise: Promise<boolean> | null = null

// ── 逾時 fetch ────────────────────────────────────────────
async function fetchWithTimeout(url: string, ms = 20000): Promise<Response> {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
  } finally {
    clearTimeout(id)
  }
}

// ── 本機 proxy 偵測 ───────────────────────────────────────
function checkLocalProxyReady(): Promise<boolean> {
  if (!localProxyReadyPromise) {
    localProxyReadyPromise = fetchWithTimeout(`${FILE_PROXY_BASE}/api/health`, 1200)
      .then(res => res.ok)
      .catch(() => false)
  }
  return localProxyReadyPromise
}

async function ensureLocalProxyReady(): Promise<void> {
  if (!isFileProtocol) return
  const ready = await checkLocalProxyReady()
  if (!ready) {
    throw new Error('離線版更新股價請使用 start-offline.bat，避免瀏覽器 file:// 的 CORS 限制')
  }
}

// ── Yahoo Finance 解析 ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractYahooPrice(text: string): number | null {
  let data: any
  try { data = JSON.parse(text) } catch { return null }
  const direct = data?.chart?.result?.[0]?.meta?.regularMarketPrice
  if (direct != null && direct > 0) return direct
  if (typeof data?.contents === 'string') {
    try {
      const inner = JSON.parse(data.contents)
      const p = inner?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (p != null && p > 0) return p
    } catch { /* ignore */ }
  }
  return null
}

async function tryYahooEndpoint(endpoint: string, timeout: number): Promise<number> {
  const res = await fetchWithTimeout(endpoint, timeout)
  if (!res.ok) throw new Error(`http-${res.status}`)
  const text = await res.text()
  const price = extractYahooPrice(text)
  if (price == null) throw new Error('no-price')
  return price
}

// ── Source 1: TWSE official real-time API（台股）──────────
async function fetchViaTWSE(ticker: string): Promise<number> {
  for (const ex of ['tse', 'otc']) {
    try {
      const res = await fetch(
        `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${ex}_${ticker}.tw`,
        { cache: 'no-store' }
      )
      if (!res.ok) continue
      const data = await res.json()
      const item = data?.msgArray?.[0]
      if (!item) continue
      const raw = item.z !== '-' ? item.z : item.y
      const price = parseFloat(raw)
      if (!isNaN(price) && price > 0) return price
    } catch { continue }
  }
  throw new Error('twse-fail')
}

// ── Source 2: Yahoo Finance ───────────────────────────────
async function fetchViaYahoo(ticker: string, market: string): Promise<number> {
  const suffix: Record<string, string> = { TW: '.TW', JP: '.T', CN: '.SS', US: '' }
  const symbol = `${ticker}${suffix[market] ?? ''}`
  const params = `?interval=1d&range=2d`
  const endpoint = isFileProtocol
    ? `${FILE_PROXY_BASE}/api/yahoo-finance/v8/finance/chart/${symbol}${params}`
    : `/api/yahoo-finance/v8/finance/chart/${symbol}${params}`
  return tryYahooEndpoint(endpoint, 15000)
}

// ── Source 2b: Yahoo Finance（基金全代碼）────────────────
async function fetchViaFundYahoo(symbol: string): Promise<number> {
  const params = `?interval=1d&range=2d`
  const endpoint = isFileProtocol
    ? `${FILE_PROXY_BASE}/api/yahoo-finance/v8/finance/chart/${encodeURIComponent(symbol)}${params}`
    : `/api/yahoo-finance/v8/finance/chart/${encodeURIComponent(symbol)}${params}`
  return tryYahooEndpoint(endpoint, 15000)
}

// ── Source 3: Stooq CSV fallback ─────────────────────────
async function tryStooqEndpoint(endpoint: string, timeout: number): Promise<number> {
  const res = await fetchWithTimeout(endpoint, timeout)
  if (!res.ok) throw new Error(`http-${res.status}`)
  const text = await res.text()
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) throw new Error('no-data')
  const cols = lines[lines.length - 1].split(',')
  const price = parseFloat(cols[4])
  if (isNaN(price) || price <= 0) throw new Error('invalid-price')
  return price
}

async function fetchViaStooq(ticker: string, market: string): Promise<number> {
  const suffix: Record<string, string> = { TW: '.tw', JP: '.jp', US: '.us', CN: '.cn' }
  const symbol = `${ticker.toLowerCase()}${suffix[market] ?? ''}`
  const endpoint = isFileProtocol
    ? `${FILE_PROXY_BASE}/api/stooq/q/d/l/?s=${symbol}&i=d`
    : `/api/stooq/q/d/l/?s=${symbol}&i=d`
  return tryStooqEndpoint(endpoint, 15000)
}

// ── 對外公開：取得單一標的現價 ───────────────────────────
export async function fetchPrice(ticker: string, market: string, assetType?: string): Promise<number> {
  const errors: string[] = []

  await ensureLocalProxyReady()

  if (assetType === 'fund') {
    if (!ticker.trim()) throw new Error('請填入 Yahoo Finance 基金代碼（如 0P0001EHG8.F）')
    if (ticker.includes('.') || ticker.toUpperCase().startsWith('0P')) {
      return fetchViaFundYahoo(ticker.trim())
    }
  }

  if (market === 'OTHER' || market === 'CASH') {
    throw new Error('此市場不支援自動取得現價')
  }

  if (market === 'TW' && !isFileProtocol) {
    try { return await fetchViaTWSE(ticker) } catch (e) { errors.push(`TWSE: ${e}`) }
  }

  try { return await fetchViaYahoo(ticker, market) } catch (e) { errors.push(`Yahoo: ${e}`) }

  try { return await fetchViaStooq(ticker, market) } catch (e) { errors.push(`Stooq: ${e}`) }

  throw new Error(`所有來源均無法取得：${errors.join(' | ')}`)
}

// ── 批次更新結果型別 ──────────────────────────────────────
export type BulkPriceResult = {
  assetId: string
  name: string
  ticker: string
  status: 'success' | 'error' | 'skip'
  price?: number
  message?: string
}
