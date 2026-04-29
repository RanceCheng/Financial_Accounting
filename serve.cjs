/**
 * 本機靜態伺服器 — 雙擊此檔案（或 node serve.cjs）即可開啟網頁
 * 不需要 npm install，只需安裝 Node.js（https://nodejs.org）
 *
 * 內建 API Proxy（同 Vite dev server）：
 *   /api/yahoo-finance  →  https://query1.finance.yahoo.com
 *   /api/stooq          →  https://stooq.com
 * 因此「更新所有股價」功能在本伺服器下完全正常運作。
 */

const http  = require('http')
const https = require('https')
const fs    = require('fs')
const path  = require('path')
const urlMod = require('url')

const PORT = 8080
const DIST = path.join(__dirname, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.woff2':'font/woff2',
}

// CORS preflight 允許標頭
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
}

/** 將 req 轉發到 targetHost，並在回應加上 CORS 標頭 */
function proxyRequest(targetHost, targetPath, req, res) {
  const options = {
    hostname: targetHost,
    path:     targetPath,
    method:   req.method,
    headers: {
      accept:            req.headers['accept'] || '*/*',
      'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      'user-agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      host:              targetHost,
    },
    timeout: 15000,
  }

  const proxyReq = https.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers, ...CORS_HEADERS }
    res.writeHead(proxyRes.statusCode, headers)
    proxyRes.pipe(res, { end: true })
  })

  proxyReq.on('timeout', () => { proxyReq.destroy() })
  proxyReq.on('error', (e) => {
    if (!res.headersSent) {
      res.writeHead(502, CORS_HEADERS)
      res.end('Proxy error: ' + e.message)
    }
  })

  proxyReq.end()
}

const server = http.createServer((req, res) => {
  const parsed   = urlMod.parse(req.url)
  const pathname = parsed.pathname
  const fullPath = parsed.path  // pathname + search (query string)

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  // Proxy: /api/yahoo-finance → query1.finance.yahoo.com
  if (pathname.startsWith('/api/yahoo-finance')) {
    const targetPath = fullPath.replace('/api/yahoo-finance', '') || '/'
    proxyRequest('query1.finance.yahoo.com', targetPath, req, res)
    return
  }

  // Proxy: /api/stooq → stooq.com
  if (pathname.startsWith('/api/stooq')) {
    const targetPath = fullPath.replace('/api/stooq', '') || '/'
    proxyRequest('stooq.com', targetPath, req, res)
    return
  }

  // SPA fallback：無副檔名一律回傳 index.html
  let filePath = path.join(DIST, pathname)
  if (!path.extname(filePath)) {
    filePath = path.join(DIST, 'index.html')
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found: ' + pathname)
      return
    }
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  const siteUrl = `http://localhost:${PORT}`
  console.log(`Financial Accounting 已啟動：${siteUrl}`)
  console.log('API Proxy 已啟用（Yahoo Finance / Stooq）')
  console.log('按 Ctrl+C 停止伺服器\n')

  const { exec } = require('child_process')
  const open =
    process.platform === 'win32'  ? `start ${siteUrl}` :
    process.platform === 'darwin' ? `open ${siteUrl}`  :
                                    `xdg-open ${siteUrl}`
  exec(open)
})
