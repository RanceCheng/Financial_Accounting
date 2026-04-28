# Financial Accounting — 功能說明文件

> 更新日期：2026-04-27

---

## 一、整體架構

| 項目 | 內容 |
|------|------|
| 框架 | React 18 + TypeScript 5 + Vite 6 |
| 樣式 | Tailwind CSS 3.4 |
| 資料庫 | Dexie.js v4（IndexedDB，離線優先） |
| 圖表 | Recharts |
| 圖示 | lucide-react |
| 表單驗證 | Zod 3 |

應用程式為純前端 SPA，所有資料儲存於瀏覽器 IndexedDB，無需後端伺服器。

---

## 二、頁面導覽

左側 Sidebar 提供三個主要頁面：

| 路由 | 頁面名稱 |
|------|----------|
| `/investment` | 投資紀錄表 |
| `/rebalance` | 資產再平衡表 |
| `/cashflow` | 收入與消費表 |

---

## 三、投資紀錄表（`/investment`）

### 3.1 統計總覽（HoldingStats）

頁面頂部顯示六張統計卡片，數值依交易紀錄篩選條件同步更新（現金與未實現損益除外）：

| 卡片 | 說明 |
|------|------|
| 現金 (TWD) | 所有帳戶餘額換算 TWD 加總 |
| 持倉標的數 | 資產管理中非現金資產的檔數 |
| 未實現損益 (TWD) | (現價 − 買入均價) × 數量，換算 TWD 加總；正數紅色、負數綠色 |
| 總投入金額 (TWD) | 依篩選條件計算買入成本換算 TWD |
| 總賣出金額 (TWD) | 依篩選條件計算賣出金額換算 TWD |
| 已實現損益 (TWD) | 依篩選條件計算已實現損益；正數紅色、負數綠色 |

> 色彩慣例（台股）：正數＝紅色、負數＝綠色。

### 3.2 匯率參考（ExchangeRatePanel）

- 顯示目前儲存的 USD、JPY、CNY 對 TWD 匯率及更新時間
- 「更新即時匯率」按鈕呼叫 `open.er-api.com` API 抓取最新匯率並寫入 IndexedDB
- 匯率用於統計卡片及交易紀錄的換算基準

### 3.3 資產管理（AssetManager）

**資產列表**

| 欄位 | 說明 |
|------|------|
| 代號 | 股票代碼 |
| 名稱 | 資產名稱 |
| 類型 | 台股 / 美股 / 日股 / 現金 / 基金 |
| 市場 | TW / US / JP / CN / CASH / OTHER |
| 幣別 | TWD / USD / JPY / CNY |
| 數量 | 目前持有數量 |
| 買入均價 | 加權平均買入價（依批次自動計算） |
| 現價 | 手動設定或即時抓取 |
| 未實現損益 | (現價 − 買入均價) × 數量；正數紅色、負數綠色 |

**即時股價抓取**

- 台股：呼叫 TWSE 官方 API（`mis.twse.com.tw`），市場收盤時回傳前收盤價
- 美股 / 日股 / 其他：依序嘗試 Vite dev proxy → allorigins CORS proxy → Yahoo Finance API
- 每筆資產右側有「刷新」按鈕，可手動觸發單支更新

**批次（Lots）管理**

- 每筆買入交易自動產生一個批次（Lot），記錄買入日期、數量、買入價
- 批次名稱格式：`{資產名稱} YYYY-MM-DD HH:mm`
- 點擊資產列可展開批次列表
- 可手動新增 / 刪除批次

**新增 / 編輯資產欄位**

- 名稱、代號、資產類型、市場、幣別、數量、買入均價、現價、備註

**其他操作**

- Google Finance 外部連結（依市場自動組合 URL）
- 欄位排序、新增、編輯、刪除（附確認對話框）

### 3.4 帳戶管理（AccountManager）

**帳戶列表**

| 欄位 | 說明 |
|------|------|
| 帳戶名稱 | 自訂名稱 |
| 類型 | 券商帳戶 / 銀行帳戶 / 現金 |
| 幣別 | TWD / USD / JPY / CNY |
| 現有資金 | 帳戶餘額；負數顯示綠色 |
| 備註 | 備用說明 |

操作：新增、編輯、刪除（附確認對話框）、欄位排序。

**轉帳功能**

- 點擊「轉帳」按鈕開啟轉帳 Modal
- 欄位：日期（datetime-local，精確到秒）、轉出帳戶、轉入帳戶、轉出金額、匯率（自動依匯率設定計算，可手動覆寫）、轉入金額（唯讀，自動計算）、手續費、備註
- 轉帳執行後自動更新兩個帳戶的餘額
- **餘額不足警告**：若轉帳後轉出帳戶餘額將低於 0，彈出確認對話框提示使用者，可選擇繼續或取消

**轉帳紀錄表格**（帳戶表下方）

| 欄位 | 說明 |
|------|------|
| 日期 | 轉帳時間 |
| 轉出帳戶 | 帳戶名稱 |
| 轉入帳戶 | 帳戶名稱 |
| 轉出幣別 | 幣別代碼 |
| 轉出金額 | 金額 |
| 轉入當下匯率 | 執行當下的換算匯率 |
| 手續費 | 手續費金額 |
| 轉出帳戶餘額 | 轉帳後轉出帳戶餘額 |
| 轉入帳戶餘額 | 轉帳後轉入帳戶餘額 |
| 操作 | 刪除（不回復餘額） |

### 3.5 交易紀錄（TransactionList）

**篩選列（Filter Bar）**

可依以下條件篩選，不填即顯示全部；篩選條件同步回傳至統計卡片：

- 日期起訖（date range）
- 幣別
- 市場
- 資產類型
- 帳戶
- 關鍵字（比對資產名稱、代號、備註）

**交易列表欄位**

| 欄位 | 說明 |
|------|------|
| 日期 | 完整時間（YYYY-MM-DD HH:mm:ss） |
| 資產 | 代號 + 名稱 |
| 帳戶 | 帳戶名稱 |
| 類型 | 彩色徽章（買入 / 賣出 / 股息 / 手續費 / 稅費 / 入金 / 出金） |
| 數量 | 交易數量 |
| 單價 | 交易單價 |
| 手續費 | 手續費 |
| 稅費 | 稅費 |
| 淨額 | 正數紅色（收入）、負數綠色（支出） |
| 備註 | 附加說明 |
| 操作 | 編輯、刪除 |

**新增 / 編輯交易**

- 日期：`datetime-local` 精確到秒，預設為當下時間
- 交易類型：買入 / 賣出 / 股息 / 手續費 / 稅費 / 入金 / 出金
- 資產：依幣別篩選可選資產
- 帳戶：依幣別篩選可用帳戶；選擇後顯示該帳戶現有資金
- 幣別、匯率（對 TWD）
- 數量：買入 / 賣出時數量不得為 0
- **單價**：若已選擇資產且資產有設定現價，右側顯示「現價 XXX」快捷按鈕，點擊自動填入
- 手續費、稅費、備註

**賣出 FIFO 邏輯**

- 賣出時依買入批次時間順序（最早優先）扣除數量
- 若資產有批次（Lots）資料，從批次扣除；若無批次但有直接欄位記錄，自動合成一個批次再扣除
- 批次數量扣完後重新計算加權平均買入價

**資料匯出 / 匯入**

- 右上角「匯出 JSON」將全部資料（帳戶、資產、交易、收支、計畫、分類、再平衡目標）打包下載
- 「匯入 JSON」讀取同格式檔案，覆寫現有資料

---

## 四、資產再平衡表（`/rebalance`）

### 功能說明

- **配置總覽**：以圓餅圖顯示目前各類別的投資比例（可切換「依資產類型」或「依幣別」）
- **再平衡目標**：設定各類別的目標佔比（百分比）及容許誤差
- **差距提示**：比較目前實際比例與目標比例，標示是否超出容許範圍
  - 在目標範圍內：顯示綠色勾選
  - 超出範圍：顯示橘色警告

**目標設定欄位**

| 欄位 | 說明 |
|------|------|
| 標籤 | 自訂名稱 |
| 分類依據 | 資產類型 / 幣別 |
| 目標鍵值 | 對應的資產類型或幣別 |
| 目標比例 | 0–100% |
| 容許誤差 | ±% |

操作：新增、編輯、刪除、欄位排序。

---

## 五、收入與消費表（`/cashflow`）

### 5.1 統計卡片

| 卡片 | 說明 |
|------|------|
| 本月收入 | 選定月份的收入加總（換算 TWD） |
| 本月支出 | 選定月份的支出加總（換算 TWD） |
| 本月淨額 | 收入 − 支出 |
| 總存款 | 所有紀錄累計淨額 |

### 5.2 四個子分頁

**月度摘要（monthly）**
- 月份選擇器
- 顯示當月收入 / 支出摘要
- 長條圖：最近數月收支趨勢
- 圓餅圖：當月支出分類佔比

**收支紀錄（records）**
- 欄位：日期、類型（收入 / 支出）、分類、金額、幣別、備註
- 新增、編輯、刪除、欄位排序

**分類管理（categories）**
- 自訂收入 / 支出分類名稱
- 新增、編輯、刪除

**月計畫（plans）**
- 為特定月份的支出分類設定預算上限
- 欄位：年月、分類、計畫金額、幣別、備註
- 新增、編輯、刪除

---

## 六、資料模型（IndexedDB）

| 資料表 | 說明 |
|--------|------|
| `accounts` | 帳戶（名稱、類型、幣別、餘額） |
| `assets` | 資產（代號、名稱、類型、市場、幣別、數量、均價、現價、批次） |
| `investmentTransactions` | 投資交易紀錄 |
| `incomeExpenseRecords` | 收支紀錄 |
| `monthlyExpensePlans` | 月支出計畫 |
| `categories` | 收支分類 |
| `rebalanceTargets` | 再平衡目標 |
| `exchangeRates` | 匯率（單筆，id = `'current'`） |
| `accountTransfers` | 帳戶轉帳紀錄 |

### 幣別

支援：`TWD`（新台幣）、`USD`（美元）、`JPY`（日圓）、`CNY`（人民幣）

### 資產類型

`tw_stock`（台股）、`us_stock`（美股）、`jp_stock`（日股）、`cash`（現金）、`fund`（基金）

### 市場

`TW`、`US`、`JP`、`CN`、`CASH`、`OTHER`

### 交易類型

`buy`（買入）、`sell`（賣出）、`dividend`（股息）、`fee`（手續費）、`tax`（稅費）、`deposit`（入金）、`withdrawal`（出金）

---

## 七、技術注意事項

- **CSS 優先度**：`src/index.css` 中 `.table td` 規則優先度高於單一 Tailwind utility，`<td>` 內的顏色覆寫須使用 `!text-*` 前綴（例如 `!text-red-500`、`!text-green-600`）
- **匯率儲存慣例**：`usdRate` 儲存「1 TWD = X USD」（約 0.031）；換算為「1 USD = X TWD」需取倒數
- **資料初始化**：首次啟動呼叫 `seedIfEmpty()` 注入預設分類與示範資料

---

## 八、計算公式與邏輯說明（2026-04-28 驗證）

> 本節說明投資紀錄表（HoldingStats）與資產再平衡表（RebalancePage）的完整計算邏輯，供人工核對。

---

### 8.1 匯率取得規則

#### 即時匯率（`getFx`）
用於現金帳戶換算、未實現損益現值換算、成本配置 fallback。

```
getFx(currency):
  TWD            → 1
  USD            → exchangeRate.usdRate   (1 USD = X TWD)
  JPY            → exchangeRate.jpyRate
  CNY            → exchangeRate.cnyRate
  其他 / 無匯率  → 1
```

#### 交易成本匯率（`fx`）
每筆交易優先使用當時記錄的 `tx.fxRateToBase`，無記錄才 fallback 即時匯率：

```
fx = tx.fxRateToBase > 0 ? tx.fxRateToBase : getFx(tx.currency)
```

#### 資產成本匯率（`costFx`）
資產層級的加權平均成本匯率，由批次（lots）計算後儲存至 `asset.fxRateToBase`：

```
costFx = asset.fxRateToBase > 0 ? asset.fxRateToBase : getFx(asset.currency)
```

---

### 8.2 投資紀錄表統計卡片（`HoldingStats.tsx`）

> 全部數值受頁面篩選條件影響（現金帳戶與未實現損益**除外**）。

#### 現金 (TWD)
```
totalBalanceTWD = Σ (acc.balance × getFx(acc.currency))
```
- 來源：所有帳戶（`accounts` 資料表）
- 使用**即時匯率**

---

#### 持倉標的數
```
assetCount = assets.filter(a => a.market !== 'CASH' && a.assetType !== 'cash').length
```
- 排除現金類型資產，不受篩選條件影響

---

#### 總投入金額 (TWD)
**語意**：篩選條件內，所有買入交易的**剩餘持倉成本基礎**（已扣除已賣出部分的成本）。

```
// 對每筆篩選後的交易，依 assetId 累積 basis:
buy / deposit:
  b.cost += qty × price × fx + (fee + tax) × fx

sell / withdrawal:
  costOfSold = (b.cost / b.qty) × qty_sold
  b.cost -= costOfSold   ← 扣除已賣出的成本

fee / tax:
  b.cost += (fee + tax) × fx

totalCostTWD = Σ b.cost (所有資產)
```

- `fx = tx.fxRateToBase > 0 ? tx.fxRateToBase : getFx(currency)`
- ⚠️ **注意**：此值為「已買入但尚未賣出的成本基礎」，而非歷史累計買入總額。若所有持倉賣出，此值趨近 0。

---

#### 總賣出金額 (TWD)
```
sell / withdrawal / dividend:
  totalSellTWD += qty × price × fx
```
- `fx = tx.fxRateToBase > 0 ? tx.fxRateToBase : getFx(currency)`
- 包含：賣出、出金、股息收入

---

#### 已實現損益 (TWD)
```
sell / withdrawal:
  b.pnl += (qty × price × fx) - (fee + tax) × fx - costOfSold

dividend:
  b.pnl += (qty × price × fx) - (fee + tax) × fx

totalRealizedPnL = Σ b.pnl (所有資產)
```
- `costOfSold` = 加權平均成本 × 賣出數量
- `fx = tx.fxRateToBase > 0 ? tx.fxRateToBase : getFx(currency)`
- 正數（獲利）顯示紅色；負數（虧損）顯示綠色（台股慣例）

---

#### 未實現損益 (TWD)
```
totalUnrealizedPnLTWD = Σ (
  currentPrice × qty × currentFx    ← 現值（即時匯率）
  - buyPrice × qty × costFx          ← 成本（成本匯率）
)
```

| 變數 | 來源 | 匯率 |
|------|------|------|
| `currentPrice` | `asset.currentPrice` | `currentFx = getFx(asset.currency)` 即時匯率 |
| `buyPrice` | `asset.buyPrice`（加權平均買入價） | `costFx = asset.fxRateToBase` 成本匯率 |

- 若 `asset.fxRateToBase` 未設定，costFx fallback 即時匯率
- ⚠️ 兩者使用**不同匯率**才能正確反映匯率損益（現值用即時，成本用買入時匯率）

---

### 8.3 資產再平衡表配置計算（`services/index.ts`）

---

#### 成本配置（`calcAllocationByAssetType` / `calcAllocationByCurrency`）

**計算基礎**：持倉資產的買入成本換算 TWD（**不含帳戶現金**）

```
per asset (qty > 0):
  costFx = asset.fxRateToBase > 0 ? asset.fxRateToBase : getExFx(exchangeRate, currency)
  cost_TWD = buyPrice × qty × costFx

amountByType[assetType] += cost_TWD    // 依資產類型
amountByCurrency[currency] += cost_TWD // 依幣別

totalTWD = Σ amountByType / amountByCurrency
```

⚠️ **成本配置不含帳戶現金**，僅統計 `assets` 表中持倉數量 > 0 的資產。

---

#### 市值配置（`calcAllocationByAssetTypeMarketValue` / `calcAllocationByCurrencyMarketValue`）

**計算基礎**：持倉資產現值 + 帳戶現金（均以即時匯率換算 TWD）

```
per asset (qty > 0 && currentPrice > 0):
  mv_TWD = currentPrice × qty × getExFx(exchangeRate, currency)
  amountByType[assetType] += mv_TWD

// 依資產類型：帳戶現金統一加入 'cash' bucket
per account:
  amountByType['cash'] += balance × getExFx(exchangeRate, acc.currency)

// 依幣別：帳戶現金按原始幣別分入對應 bucket
per account:
  amountByCurrency[acc.currency] += balance × getExFx(exchangeRate, acc.currency)

totalTWD = Σ all buckets
```

⚠️ **市值配置含帳戶現金**，因此「依資產類型」視圖的現金 bucket 涵蓋所有幣別帳戶餘額。

---

#### AllocationItem 共通欄位計算

| 欄位 | 公式 |
|------|------|
| `currentPercent` | `amt / totalTWD` |
| `targetAmountTWD` | `targetPercent × totalTWD` |
| `diffAmountTWD` | `targetAmountTWD - amt`（正 = 需買入，負 = 超額） |
| `isWithinTolerance` | `|currentPercent - targetPercent| <= tolerancePercent` |

---

### 8.4 成本配置 vs 市值配置差異對照

| 維度 | 成本配置 | 市值配置 |
|------|---------|---------|
| 價格基礎 | 買入均價（`asset.buyPrice`） | 目前現價（`asset.currentPrice`） |
| 匯率 | 成本匯率（`asset.fxRateToBase`） | 即時匯率（`exchangeRate.*Rate`） |
| 帳戶現金 | ❌ 不含 | ✅ 含（依幣別或統一歸入 cash） |
| 篩選條件 | qty > 0 | qty > 0 且 currentPrice > 0 |

---

### 8.5 資產成本匯率（`asset.fxRateToBase`）計算與更新時機

`asset.fxRateToBase` 為所有批次（lots）的**數量加權平均成本匯率**：

```
withFx = lots.filter(l => l.fxRateToBase > 0 && qty > 0)
fxWeightedSum = Σ (lot.fxRateToBase × lot.quantity)
fxQty = Σ lot.quantity

asset.fxRateToBase = fxWeightedSum / fxQty
```

**自動更新時機**：
1. 新增交易（買入）→ 建立新批次，重算並持久化
2. 賣出交易 → 移除相應批次，重算並持久化
3. 編輯批次 → 重算並持久化
4. 刪除批次 → 重算並持久化
5. 新增資產（無批次）→ 帶入當前即時匯率

---

### 8.6 已知設計限制（非 Bug）

| 項目 | 說明 |
|------|------|
| 總投入金額語意 | 為剩餘持倉成本基礎，非歷史累計買入總額 |
| 成本配置無現金 | 現金無「買入成本」概念，故不納入成本配置 |
| 舊批次無成本匯率 | 匯入或手動建立的舊批次若無 `fxRateToBase`，顯示時 fallback 即時匯率（非買入時匯率） |
| TWD 成本匯率 | 固定顯示 `1`，不受匯率變動影響 |


> Version：0.2　　最後更新：2026-04-23

---

## 目錄

1. [開發框架與技術棧](#一開發框架與技術棧)
2. [專案目錄結構](#二專案目錄結構)
3. [功能整理](#三功能整理)
4. [資料層 API 整理](#四資料層-api-整理)
5. [JSON 匯出入資料格式與放置位置](#五json-匯出入資料格式與放置位置)

---

## 一、開發框架與技術棧

| 分類 | 套件 / 工具 | 版本 | 用途 |
|------|------------|------|------|
| 前端框架 | React | 18 | UI 元件與生命週期 |
| 語言 | TypeScript | 5 | 靜態型別 |
| 建置工具 | Vite | 6 | 開發伺服器、打包；含 proxy 設定 |
| 樣式 | Tailwind CSS | 3.4 | Utility-first CSS |
| 狀態管理 | Zustand | 5 | 全域 UI 狀態（側欄開關等） |
| 本地資料庫 | Dexie.js (IndexedDB) | 4 | 離線優先資料儲存（v2 schema） |
| 響應式查詢 | dexie-react-hooks | — | DB 變更自動更新 UI |
| 資料驗證 | Zod | 3.23 | 表單輸入與匯入 JSON 驗證 |
| 圖表 | Recharts | 2.13 | 圓餅圖、長條圖 |
| 路由 | React Router DOM | 6 | SPA 頁面切換 |
| 圖示 | lucide-react | 0.468 | SVG Icon 元件庫 |
| UUID | uuid | 11 | 主鍵生成 |
| 日期 | date-fns | 4 | 日期格式化 |

### Vite Proxy 設定（開發伺服器）

`vite.config.ts` 設定兩組 proxy，讓瀏覽器繞過 CORS 限制：

| 路由前綴 | 代理目標 | 用途 |
|---------|---------|------|
| `/api/yahoo-finance` | `https://query1.finance.yahoo.com` | 股票 / 基金報價 |
| `/api/stooq` | `https://stooq.com` | Stooq CSV 報價備援 |

### 啟動指令

```bash
npm install      # 安裝依賴
npm run dev      # 開發伺服器 → http://localhost:5173
npm run build    # 正式打包 → dist/
npm run preview  # 預覽打包結果
```

---

## 二、專案目錄結構

```
src/
├── App.tsx                     # 根元件（初始化 seed、Router 入口）
├── main.tsx                    # React 18 createRoot 進入點
├── index.css                   # Tailwind 基礎樣式 + 自訂元件類別
│
├── app/
│   └── router/index.tsx        # React Router 路由設定
│
├── lib/
│   ├── constants.ts            # 業務常數（幣別、資產類型、市場、交易類型等）
│   ├── formatters.ts           # 格式化工具（貨幣、日期、百分比）
│   └── sorting.ts              # 通用排序 hook（useSortable）與工具函式（sortByKey）
│
├── stores/
│   └── uiStore.ts              # Zustand UI 狀態（側欄開關）
│
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx       # Sidebar + TopBar + 主框架
│   └── common/
│       ├── Modal.tsx           # 通用 Modal（sm/md/lg/xl）
│       ├── ConfirmDialog.tsx   # 確認對話框
│       ├── StatCard.tsx        # KPI 統計卡片
│       ├── SortTh.tsx          # 可排序表格欄位標題元件
│       └── ImportExportButtons.tsx  # 匯出 / 匯入 JSON 按鈕
│
├── data/
│   ├── db.ts                   # Dexie 資料庫定義（8 張資料表，v2 schema）
│   ├── seed.ts                 # 初始資料植入 + 重複分類清理
│   ├── types/index.ts          # TypeScript 介面定義
│   ├── schemas/index.ts        # Zod 驗證 Schema
│   ├── repositories/index.ts  # CRUD 資料存取層
│   └── services/
│       ├── index.ts            # 商業邏輯計算
│       └── importExport.ts     # JSON 匯出入 + 完整性驗證
│
└── features/
    ├── investment/
    │   ├── InvestmentPage.tsx  # 投資紀錄表主頁（含彩色 pill 頁籤、匯率面板）
    │   ├── TransactionList.tsx # 交易清單（篩選 + CRUD + 排序）
    │   ├── AssetManager.tsx    # 資產管理（CRUD + 排序 + 自動更新股價）
    │   ├── AccountManager.tsx  # 帳戶管理（CRUD + 排序）
    │   ├── HoldingStats.tsx    # 持倉統計卡片
    │   └── ExchangeRatePanel.tsx  # 匯率顯示與即時更新面板
    ├── rebalance/
    │   └── RebalancePage.tsx   # 資產再平衡表（含排序）
    └── cashflow/
        └── CashflowPage.tsx    # 收入與消費表（含排序）
```

---

## 三、功能整理

### 3.1 投資紀錄表（`/investment`）

| 子頁籤 | 功能 |
|--------|------|
| 資產管理 | 新增 / 編輯 / 刪除投資標的（台股、美股、日股、現金、基金）；欄位含買入價格、現價；支援自動更新股價（單筆 / 批量）；所有欄位可排序 |
| 帳戶管理 | 新增 / 編輯 / 刪除帳戶（券商、銀行、現金帳戶）；所有欄位可排序 |
| 交易紀錄 | 新增 / 編輯 / 刪除投資交易；支援買入、賣出、配息、手續費、稅費、入金、出金 7 種類型；所有欄位可排序 |
| 交易篩選 | 依日期區間、幣別、市場、資產類型、帳戶、關鍵字 6 維度篩選 |
| 持倉統計 | 自動計算總投入（TWD）、總賣出、已實現損益、持倉標的數（同步資產管理）、現金餘額 |
| 匯率面板 | 顯示 TWD/USD/JPY/CNY 即時匯率；可一鍵從 open.er-api.com 更新 |

**自動更新股價來源（優先順序）：**

| 市場 / 類型 | 來源 1 | 來源 2 | 來源 3 |
|------------|--------|--------|--------|
| 台股（TW） | TWSE 官方 API | Yahoo Finance（Vite proxy） | Stooq CSV |
| 美股 / 日股 / 陸股 | Yahoo Finance（Vite proxy） | allorigins.win proxy | Stooq CSV |
| 基金（任何市場） | Yahoo Finance（Vite proxy，完整代碼如 `0P0001CN2O`） | allorigins.win proxy | — |
| 現金 / 其他 | 不支援 | — | — |

### 3.2 資產再平衡表（`/rebalance`）

| 功能 | 說明 |
|------|------|
| 配置視角切換 | 依資產類型 / 依幣別 兩種視角 |
| 圓餅圖 | Recharts PieChart 顯示當前配置比例 |
| 再平衡建議 | 顯示當前比例、目標比例、差額（TWD）、調整進度條、是否在容忍範圍內 |
| 目標設定 CRUD | 新增 / 編輯 / 刪除各類型目標比例與容忍誤差；所有欄位可排序 |
| 總資產 | 所有持倉換算為 TWD 後的合計 |

### 3.3 收入與日常消費表（`/cashflow`）

| 子頁籤 | 功能 |
|--------|------|
| 月度總覽 | 12 個月收入/支出/計畫支出趨勢長條圖；當月支出分類圓餅圖；月度統計卡片（收入、支出、計畫支出、結餘、儲蓄率） |
| 收支紀錄 | 新增 / 編輯 / 刪除收入或支出；依月份篩選；顯示分類名稱；所有欄位可排序 |
| 月支出計畫 | 新增 / 編輯 / 刪除各分類每月計畫金額；依年月篩選；所有欄位可排序 |
| 分類管理 | 新增 / 編輯 / 刪除收入與支出分類；已內建 16 個預設分類；所有欄位可排序 |

### 3.4 通用功能

| 功能 | 說明 |
|------|------|
| JSON 匯出 | 將全部資料打包為單一 JSON 檔案下載至本機 |
| JSON 匯入 | 上傳 JSON 檔案，通過 Zod Schema 驗證 + 外鍵完整性驗證後批次寫入 |
| 離線優先 | 所有資料存於瀏覽器 IndexedDB，無需網路連線 |
| 響應式佈局 | 側邊欄在行動裝置可收合為 Overlay |
| 表格排序 | 所有表格均支援點擊欄位標題升冪 / 降冪排序（`SortTh` 元件） |

---

## 四、資料層 API 整理

### 4.1 Repository（CRUD 存取層）

所有 Repository 位於 `src/data/repositories/index.ts`，每個資料表提供相同介面：

```typescript
repo.getAll()                          // 取得全部記錄
repo.getById(id: string)               // 依 ID 取得單筆
repo.add(input: XxxInput)              // 新增（自動填入 id / createdAt / updatedAt）
repo.update(id: string, input: Partial<XxxInput>)  // 更新（自動更新 updatedAt）
repo.delete(id: string)                // 刪除
```

| Repository | 對應資料表 | 額外方法 |
|-----------|-----------|---------|
| `accountRepo` | `accounts` | — |
| `assetRepo` | `assets` | — |
| `investmentTxRepo` | `investmentTransactions` | — |
| `incomeExpenseRepo` | `incomeExpenseRecords` | — |
| `monthlyPlanRepo` | `monthlyExpensePlans` | `getByMonth(yearMonth)` |
| `categoryRepo` | `categories` | — |
| `rebalanceTargetRepo` | `rebalanceTargets` | — |
| `exchangeRateRepo` | `exchangeRates` | `save(rate)` |

### 4.2 Service（商業邏輯計算）

位於 `src/data/services/index.ts`：

| 函式 | 輸入 | 輸出 | 說明 |
|------|------|------|------|
| `calcHoldingStats(transactions, assetId)` | 交易陣列、資產ID | `HoldingStats` | 計算單一資產持倉（均價、成本、已實現損益） |
| `calcAllHoldings(transactions, assets)` | 交易陣列、資產陣列 | `HoldingStats[]` | 計算全部資產持倉 |
| `calcAllocationByAssetType(...)` | 持倉、資產、目標 | `AllocationItem[]` | 依資產類型計算配置比例 |
| `calcAllocationByCurrency(...)` | 持倉、資產、目標 | `AllocationItem[]` | 依幣別計算配置比例 |
| `calcMonthlySummaries(records, plans)` | 收支記錄、計畫陣列 | `MonthlySummary[]` | 每月收入/支出/計畫/結餘/儲蓄率 |
| `calcExpenseByCategory(records, categories, yearMonth?)` | 記錄、分類、月份 | `{name, amount}[]` | 各分類支出加總（可篩選月份） |

### 4.3 Import / Export Service

位於 `src/data/services/importExport.ts`：

| 函式 | 說明 |
|------|------|
| `exportAppData()` | 從 IndexedDB 取出全部資料，組成 `AppData` 物件 |
| `downloadJson(data)` | 觸發瀏覽器下載 JSON 檔案（`financial_accounting_YYYY-MM-DD.json`） |
| `importAppData(jsonStr)` | 解析 JSON → Zod 驗證 → 完整性驗證 → 清空後批次寫入 |
| `validateIntegrity(data)` | 檢查外鍵是否都有對應記錄，回傳 `{ valid, errors[] }` |

### 4.4 Sorting 工具（`src/lib/sorting.ts`）

| 函式 / Hook | 說明 |
|------------|------|
| `useSortable(defaultKey, defaultDir?)` | 管理表格排序狀態（sortKey、sortDir、handleSort） |
| `sortByKey<T>(items, key, dir, getValue)` | 泛型排序，支援字串與數字比較 |

### 4.5 IndexedDB 資料表與索引

資料庫名稱：`FinancialAccountingDB`（版本 2）

| 資料表 | 主鍵 | 索引欄位 |
|--------|------|---------|
| `accounts` | `id` | `type, currency, name` |
| `assets` | `id` | `assetType, market, currency, ticker, name` |
| `investmentTransactions` | `id` | `date, assetId, accountId, txType, currency` |
| `incomeExpenseRecords` | `id` | `date, type, categoryId, currency` |
| `monthlyExpensePlans` | `id` | `yearMonth, categoryId` |
| `categories` | `id` | `type, name` |
| `rebalanceTargets` | `id` | `targetType, targetKey` |
| `exchangeRates` | `id` | — |

---

## 五、JSON 匯出入資料格式與放置位置

### 5.1 檔案位置

JSON 備份檔案由**使用者自行決定存放位置**（瀏覽器下載至本機）。  
匯入時透過畫面上的「匯入 JSON」按鈕選取本機檔案即可。

> 程式碼中不存在固定的 JSON 目錄；所有即時資料皆存於瀏覽器 **IndexedDB**。

### 5.2 匯出 JSON 完整結構

```jsonc
{
  "meta": {
    "version": "1.0.0",
    "lastModified": "2026-04-23T00:00:00.000Z",
    "baseCurrency": "TWD",
    "supportedCurrencies": ["TWD", "USD", "JPY", "CNY"]
  },
  "accounts": [
    {
      "id": "uuid",
      "name": "富邦證券",
      "type": "brokerage",       // "brokerage" | "bank" | "cash"
      "currency": "TWD",
      "balance": 100000,
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "assets": [
    {
      "id": "uuid",
      "name": "台積電",
      "ticker": "2330",
      "assetType": "tw_stock",   // "tw_stock" | "us_stock" | "jp_stock" | "cash" | "fund"
      "market": "TW",            // "TW" | "US" | "JP" | "CN" | "CASH" | "OTHER"
      "currency": "TWD",
      "buyPrice": 850.0,         // 選填，買入參考價格
      "currentPrice": 920.0,     // 選填，最新市價（可自動更新）
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "investmentTransactions": [
    {
      "id": "uuid",
      "date": "YYYY-MM-DD",
      "assetId": "uuid",
      "accountId": "uuid",
      "txType": "buy",           // "buy" | "sell" | "dividend" | "fee" | "tax" | "deposit" | "withdrawal"
      "quantity": 1000,
      "price": 850.0,
      "currency": "TWD",
      "fxRateToBase": 1.0,       // 換算為 TWD 的匯率
      "fee": 50,
      "tax": 0,
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "incomeExpenseRecords": [
    {
      "id": "uuid",
      "date": "YYYY-MM-DD",
      "type": "expense",         // "income" | "expense"
      "categoryId": "uuid",
      "amount": 15000,
      "currency": "TWD",
      "fxRateToBase": 1.0,
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "monthlyExpensePlans": [
    {
      "id": "uuid",
      "yearMonth": "2026-04",    // YYYY-MM 格式
      "categoryId": "uuid",
      "plannedAmount": 10000,
      "currency": "TWD",
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "categories": [
    {
      "id": "uuid",
      "name": "餐飲",
      "type": "expense",         // "income" | "expense"
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "rebalanceTargets": [
    {
      "id": "uuid",
      "label": "台股",
      "targetType": "assetType", // "assetType" | "currency"
      "targetKey": "tw_stock",
      "targetPercent": 0.5,      // 0–1（小數）
      "tolerancePercent": 0.05,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

### 5.3 預設分類清單

**收入分類（5 項）**

| 名稱 |
|------|
| 薪資 |
| 獎金 |
| 股利 |
| 利息 |
| 其他收入 |

**支出分類（11 項）**

| 名稱 |
|------|
| 房租 |
| 餐飲 |
| 交通 |
| 水電瓦斯 |
| 娛樂 |
| 保險 |
| 醫療 |
| 購物 |
| 旅遊 |
| 金融投資 |
| 其他支出 |

---

*本文件由 GitHub Copilot 依程式碼自動生成，最後更新：2026-04-23*

---

## 目錄

1. [開發框架與技術棧](#一開發框架與技術棧)
2. [專案目錄結構](#二專案目錄結構)
3. [功能整理](#三功能整理)
4. [資料層 API 整理](#四資料層-api-整理)
5. [JSON 匯出入資料格式與放置位置](#五json-匯出入資料格式與放置位置)

---

## 一、開發框架與技術棧

| 分類 | 套件 / 工具 | 版本 | 用途 |
|------|------------|------|------|
| 前端框架 | React | 18 | UI 元件與生命週期 |
| 語言 | TypeScript | 5 | 靜態型別 |
| 建置工具 | Vite | 6 | 開發伺服器、打包 |
| 樣式 | Tailwind CSS | 3.4 | Utility-first CSS |
| 狀態管理 | Zustand | 5 | 全域 UI 狀態（側欄開關等） |
| 本地資料庫 | Dexie.js (IndexedDB) | 4 | 離線優先資料儲存 |
| 響應式查詢 | dexie-react-hooks | — | DB 變更自動更新 UI |
| 資料驗證 | Zod | 3.23 | 表單輸入與匯入 JSON 驗證 |
| 圖表 | Recharts | 2.13 | 圓餅圖、長條圖 |
| 路由 | React Router DOM | 6 | SPA 頁面切換 |
| 圖示 | lucide-react | 0.468 | SVG Icon 元件庫 |
| UUID | uuid | 11 | 主鍵生成 |
| 日期 | date-fns | 4 | 日期格式化 |

### 啟動指令

```bash
npm install      # 安裝依賴
npm run dev      # 開發伺服器 → http://localhost:5173
npm run build    # 正式打包 → dist/
npm run preview  # 預覽打包結果
```

---

## 二、專案目錄結構

```
src/
├── App.tsx                     # 根元件（初始化 seed、Router 入口）
├── main.tsx                    # React 18 createRoot 進入點
├── index.css                   # Tailwind 基礎樣式 + 自訂元件類別
│
├── app/
│   └── router/index.tsx        # React Router 路由設定
│
├── lib/
│   ├── constants.ts            # 業務常數（幣別、資產類型、交易類型等）
│   └── formatters.ts           # 格式化工具（貨幣、日期、百分比）
│
├── stores/
│   └── uiStore.ts              # Zustand UI 狀態（側欄開關）
│
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx       # Sidebar + TopBar + 主框架
│   └── common/
│       ├── Modal.tsx           # 通用 Modal（sm/md/lg/xl）
│       ├── ConfirmDialog.tsx   # 確認對話框
│       ├── StatCard.tsx        # KPI 統計卡片
│       └── ImportExportButtons.tsx  # 匯出 / 匯入 JSON 按鈕
│
├── data/
│   ├── db.ts                   # Dexie 資料庫定義（7 張資料表）
│   ├── seed.ts                 # 初始資料植入 + 重複分類清理
│   ├── types/index.ts          # TypeScript 介面定義
│   ├── schemas/index.ts        # Zod 驗證 Schema
│   ├── repositories/index.ts  # CRUD 資料存取層
│   └── services/
│       ├── index.ts            # 商業邏輯計算
│       └── importExport.ts     # JSON 匯出入 + 完整性驗證
│
└── features/
    ├── investment/
    │   ├── InvestmentPage.tsx  # 投資紀錄表主頁
    │   ├── TransactionList.tsx # 交易清單（篩選 + CRUD）
    │   ├── AssetManager.tsx    # 資產管理 CRUD
    │   ├── AccountManager.tsx  # 帳戶管理 CRUD
    │   └── HoldingStats.tsx    # 持倉統計卡片
    ├── rebalance/
    │   └── RebalancePage.tsx   # 資產再平衡表
    └── cashflow/
        └── CashflowPage.tsx    # 收入與消費表
```

---

## 三、功能整理

### 3.1 投資紀錄表（`/investment`）

| 子頁籤 | 功能 |
|--------|------|
| 交易紀錄 | 新增 / 編輯 / 刪除投資交易；支援買入、賣出、配息、手續費、稅費、入金、出金 7 種類型 |
| 交易篩選 | 依日期區間、幣別、市場、資產類型、帳戶、關鍵字 6 維度篩選 |
| 持倉統計 | 自動計算總投入（TWD）、總賣出、已實現損益、持倉檔數 |
| 資產管理 | 新增 / 編輯 / 刪除投資標的（台股、美股、日股、現金、基金） |
| 帳戶管理 | 新增 / 編輯 / 刪除帳戶（券商、銀行、現金帳戶） |

### 3.2 資產再平衡表（`/rebalance`）

| 功能 | 說明 |
|------|------|
| 配置視角切換 | 依資產類型 / 依幣別 兩種視角 |
| 圓餅圖 | Recharts PieChart 顯示當前配置比例 |
| 再平衡建議 | 顯示當前比例、目標比例、差額（TWD）、調整進度條、是否在容忍範圍內 |
| 目標設定 CRUD | 新增 / 編輯 / 刪除各類型目標比例與容忍誤差 |
| 總資產 | 所有持倉換算為 TWD 後的合計 |

### 3.3 收入與日常消費表（`/cashflow`）

| 子頁籤 | 功能 |
|--------|------|
| 月度總覽 | 12 個月收入/支出/計畫支出趨勢長條圖；當月支出分類圓餅圖；月度統計卡片（收入、支出、計畫支出、結餘、儲蓄率） |
| 收支紀錄 | 新增 / 編輯 / 刪除收入或支出；依月份篩選；顯示分類名稱 |
| 月支出計畫 | 新增 / 編輯 / 刪除各分類每月計畫金額；依年月篩選 |
| 分類管理 | 新增 / 編輯 / 刪除收入與支出分類；已內建 16 個預設分類 |

### 3.4 通用功能

| 功能 | 說明 |
|------|------|
| JSON 匯出 | 將全部資料打包為單一 JSON 檔案下載至本機 |
| JSON 匯入 | 上傳 JSON 檔案，通過 Zod Schema 驗證 + 外鍵完整性驗證後批次寫入 |
| 離線優先 | 所有資料存於瀏覽器 IndexedDB，無需網路連線 |
| 響應式佈局 | 側邊欄在行動裝置可收合為 Overlay |

---

## 四、資料層 API 整理

### 4.1 Repository（CRUD 存取層）

所有 Repository 位於 `src/data/repositories/index.ts`，每個資料表提供相同介面：

```typescript
repo.getAll()                          // 取得全部記錄
repo.getById(id: string)               // 依 ID 取得單筆
repo.add(input: XxxInput)              // 新增（自動填入 id / createdAt / updatedAt）
repo.update(id: string, input: Partial<XxxInput>)  // 更新（自動更新 updatedAt）
repo.delete(id: string)                // 刪除
```

| Repository | 對應資料表 | 額外方法 |
|-----------|-----------|---------|
| `accountRepo` | `accounts` | — |
| `assetRepo` | `assets` | — |
| `investmentTxRepo` | `investmentTransactions` | — |
| `incomeExpenseRepo` | `incomeExpenseRecords` | — |
| `monthlyPlanRepo` | `monthlyExpensePlans` | `getByMonth(yearMonth)` |
| `categoryRepo` | `categories` | — |
| `rebalanceTargetRepo` | `rebalanceTargets` | — |

### 4.2 Service（商業邏輯計算）

位於 `src/data/services/index.ts`：

| 函式 | 輸入 | 輸出 | 說明 |
|------|------|------|------|
| `calcHoldingStats(transactions, assetId)` | 交易陣列、資產ID | `HoldingStats` | 計算單一資產持倉（均價、成本、已實現損益） |
| `calcAllHoldings(transactions, assets)` | 交易陣列、資產陣列 | `HoldingStats[]` | 計算全部資產持倉 |
| `calcAllocationByAssetType(...)` | 持倉、資產、目標 | `AllocationItem[]` | 依資產類型計算配置比例 |
| `calcAllocationByCurrency(...)` | 持倉、資產、目標 | `AllocationItem[]` | 依幣別計算配置比例 |
| `calcMonthlySummaries(records, plans)` | 收支記錄、計畫陣列 | `MonthlySummary[]` | 每月收入/支出/計畫/結餘/儲蓄率 |
| `calcExpenseByCategory(records, categories, yearMonth?)` | 記錄、分類、月份 | `{name, amount}[]` | 各分類支出加總（可篩選月份） |

### 4.3 Import / Export Service

位於 `src/data/services/importExport.ts`：

| 函式 | 說明 |
|------|------|
| `exportAppData()` | 從 IndexedDB 取出全部資料，組成 `AppData` 物件 |
| `downloadJson(data)` | 觸發瀏覽器下載 JSON 檔案（`financial_accounting_YYYY-MM-DD.json`） |
| `importAppData(jsonStr)` | 解析 JSON → Zod 驗證 → 完整性驗證 → 清空後批次寫入 |
| `validateIntegrity(data)` | 檢查外鍵是否都有對應記錄，回傳 `{ valid, errors[] }` |

### 4.4 IndexedDB 資料表與索引

資料庫名稱：`FinancialAccountingDB`（版本 1）

| 資料表 | 主鍵 | 索引欄位 |
|--------|------|---------|
| `accounts` | `id` | `type, currency, name` |
| `assets` | `id` | `assetType, market, currency, ticker, name` |
| `investmentTransactions` | `id` | `date, assetId, accountId, txType, currency` |
| `incomeExpenseRecords` | `id` | `date, type, categoryId, currency` |
| `monthlyExpensePlans` | `id` | `yearMonth, categoryId` |
| `categories` | `id` | `type, name` |
| `rebalanceTargets` | `id` | `targetType, targetKey` |

---

## 五、JSON 匯出入資料格式與放置位置

### 5.1 檔案位置

JSON 備份檔案由**使用者自行決定存放位置**（瀏覽器下載至本機）。  
匯入時透過畫面上的「匯入 JSON」按鈕選取本機檔案即可。

> 程式碼中不存在固定的 JSON 目錄；所有即時資料皆存於瀏覽器 **IndexedDB**。

### 5.2 匯出 JSON 完整結構

```jsonc
{
  "meta": {
    "version": "1.0.0",
    "lastModified": "2026-04-22T00:00:00.000Z",
    "baseCurrency": "TWD",
    "supportedCurrencies": ["TWD", "USD", "JPY", "CNY"]
  },
  "accounts": [
    {
      "id": "uuid",
      "name": "富邦證券",
      "type": "brokerage",       // "brokerage" | "bank" | "cash"
      "currency": "TWD",
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "assets": [
    {
      "id": "uuid",
      "name": "台積電",
      "ticker": "2330",
      "assetType": "tw_stock",   // "tw_stock" | "us_stock" | "jp_stock" | "cash" | "fund"
      "market": "TW",            // "TW" | "US" | "JP" | "CN" | "CASH"
      "currency": "TWD",
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "investmentTransactions": [
    {
      "id": "uuid",
      "date": "YYYY-MM-DD",
      "assetId": "uuid",
      "accountId": "uuid",
      "txType": "buy",           // "buy" | "sell" | "dividend" | "fee" | "tax" | "deposit" | "withdrawal"
      "quantity": 1000,
      "price": 850.0,
      "currency": "TWD",
      "fxRateToBase": 1.0,       // 換算為 TWD 的匯率
      "fee": 50,
      "tax": 0,
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "incomeExpenseRecords": [
    {
      "id": "uuid",
      "date": "YYYY-MM-DD",
      "type": "expense",         // "income" | "expense"
      "categoryId": "uuid",
      "amount": 15000,
      "currency": "TWD",
      "fxRateToBase": 1.0,
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "monthlyExpensePlans": [
    {
      "id": "uuid",
      "yearMonth": "2026-04",    // YYYY-MM 格式
      "categoryId": "uuid",
      "plannedAmount": 10000,
      "currency": "TWD",
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "categories": [
    {
      "id": "uuid",
      "name": "餐飲",
      "type": "expense",         // "income" | "expense"
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "rebalanceTargets": [
    {
      "id": "uuid",
      "targetType": "assetType", // "assetType" | "currency"
      "targetKey": "tw_stock",
      "targetPercent": 50,       // 0–100
      "tolerancePercent": 5,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

### 5.3 預設分類清單

**收入分類（5 項）**

| 名稱 |
|------|
| 薪資 |
| 獎金 |
| 股利 |
| 利息 |
| 其他收入 |

**支出分類（11 項）**

| 名稱 |
|------|
| 房租 |
| 餐飲 |
| 交通 |
| 水電瓦斯 |
| 娛樂 |
| 保險 |
| 醫療 |
| 購物 |
| 旅遊 |
| 金融投資 |
| 其他支出 |

---

*本文件由 GitHub Copilot 依程式碼自動生成*
