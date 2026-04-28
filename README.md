# Financial Accounting

> 純前端個人財務管理工具，所有資料儲存於瀏覽器 IndexedDB，**完全離線可用，無需後端伺服器**。

---

## 三大功能

### 1. 投資紀錄表
管理股票、基金等投資資產與帳戶，完整追蹤買賣損益。

- 資產管理：新增/編輯/刪除投資標的（台股、美股、日股、基金），支援一鍵即時更新股價
- 帳戶管理：管理券商/銀行/現金帳戶，支援跨幣別帳戶轉帳
- 交易紀錄：支援買入、賣出、股息、手續費、稅費、入金、出金 7 種類型，採 FIFO 計算賣出損益
- 持倉統計：自動計算總投入、總賣出、已實現損益、未實現損益（台股慣例紅漲綠跌）
- 即時匯率：從 `open.er-api.com` 更新 USD/JPY/CNY 對 TWD 匯率

### 2. 資產再平衡表
依資產類型或幣別，視覺化呈現目前配置比例並提供再平衡建議。

- 圓餅圖顯示目前各類別佔比（成本配置 vs 市值配置）
- 設定各類別目標比例與容許誤差，自動標示是否需要調整
- 計算達到目標比例所需買入/賣出的 TWD 金額

### 3. 收入與日常消費表
追蹤日常收支、設定每月預算計畫，分析月度收支趨勢。

- 月度總覽：收支趨勢長條圖、支出分類圓餅圖（依金額排序）、月度摘要表
- 收支紀錄：含幣別、分類、現金帳戶連結，儲存後自動更新帳戶餘額
- 固定月計畫：分別設定固定收入/支出計畫，一鍵批次匯入為當月實際紀錄
- 分類管理：自訂收入/支出分類，內建 16 個預設分類

---

## 離線使用方式

### ⭐ 方式一：一鍵本機啟動（推薦，無需安裝任何套件）

> 前提：已安裝 [Node.js](https://nodejs.org)（僅需 Node.js 本身，不需 npm install）

```bash
node serve.cjs
# → 自動開啟瀏覽器 http://localhost:8080
```

或直接在檔案總管中雙擊 `serve.cjs`，瀏覽器會自動開啟。按 `Ctrl+C` 停止。

### 方式二：npm preview（需先 npm install）

```bash
npm run build        # 打包 → dist/
npm run preview      # 預覽 → http://localhost:4173
```

### 方式三：部署 `dist/` 目錄至任意靜態伺服器
將 `dist/` 目錄內的所有檔案部署至 Apache、Nginx、GitHub Pages 等即可。

> 已提供打包好的 [`dist.zip`](dist.zip)，下載解壓縮後直接部署或搭配 `serve.cjs` 使用，無需自行執行打包指令。

---

## 打包輸出檔案（`dist/`）

| 檔案 | 說明 |
|------|------|
| `dist/index.html` | 入口 HTML（約 0.4 KB） |
| `dist/assets/index-*.js` | 所有 JS + CSS 程式碼（約 921 KB，gzip 後約 254 KB） |

> IIFE 格式打包，CSS 內嵌於 JS 中，支援 `file://` 直接開啟與 `node serve.cjs` 本機伺服器兩種模式。
>
> 所有資料僅存於使用者瀏覽器的 IndexedDB，清除瀏覽器資料前資料不會遺失。
> 可使用內建「匯出 JSON」功能定期備份資料。

---

## 使用限制

| 功能 | `node serve.cjs` | 雙擊 `index.html` |
|------|:---:|:---:|
| 基本介面 | ✅ | ✅ |
| 更新股價 / 匯率 | ✅（內建 Proxy） | ⚠️（受瀏覽器 CORS 限制） |
| 資料儲存（IndexedDB） | ✅ | ✅ |

> 建議使用 `node serve.cjs` 以獲得完整功能。

---

## 本機開發

```bash
npm install          # 安裝依賴
npm run dev          # 開發伺服器（含股票 API Proxy）
npm run build        # 正式打包
```

### 常用測試網址

| 頁面 | 網址 |
|------|------|
| 投資紀錄表 | http://localhost:5173/investment |
| 資產再平衡表 | http://localhost:5173/rebalance |
| 收入與日常消費表 | http://localhost:5173/cashflow |

詳細功能說明請參閱 [DOCUMENT.md](DOCUMENT.md)。
