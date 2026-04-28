# Financial Accounting — 功能說明文件

> 版本：1.0.0　　最後更新：2025-07-15

---

## 目錄

1. [整體架構](#一整體架構)
2. [啟動指令與 Proxy 設定](#二啟動指令與-proxy-設定)
3. [專案目錄結構](#三專案目錄結構)
4. [頁面導覽](#四頁面導覽)
5. [投資紀錄表](#五投資紀錄表-investment)
6. [資產再平衡表](#六資產再平衡表-rebalance)
7. [收入與日常消費表](#七收入與日常消費表-cashflow)
8. [通用功能](#八通用功能)
9. [資料層 API 整理](#九資料層-api-整理)
10. [IndexedDB Schema 版本歷程](#十indexeddb-schema版本歷程)
11. [JSON 匯出入格式](#十一json-匯出入格式)
12. [計算公式與邏輯說明](#十二計算公式與邏輯說明)
13. [技術注意事項](#十三技術注意事項)

---

## 一、整體架構

| 項目 | 內容 |
|------|------|
| 框架 | React 18 + TypeScript 5 + Vite 6 |
| 樣式 | Tailwind CSS 3.4 |
| 資料庫 | Dexie.js v4 封裝 IndexedDB（離線優先，目前 Schema v6） |
| 圖表 | Recharts 2.13 |
| 圖示 | lucide-react 0.468 |
| 表單驗證 | Zod 3.23 |
| 路由 | React Router DOM 6 |
| 狀態管理 | Zustand 5 |
| UUID | uuid 11 |
| 日期 | date-fns 4 |

應用程式為純前端 SPA，所有資料儲存於瀏覽器 IndexedDB，**無需後端伺服器**。

---

## 二、啟動指令與 Proxy 設定

```bash
npm install      # 安裝依賴
npm run dev      # 開發伺服器 → http://localhost:5173
npm run build    # 正式打包 → dist/
npm run preview  # 預覽打包結果
```

`vite.config.ts` 設定兩組 proxy，讓瀏覽器繞過 CORS 限制：

| 路由前綴 | 代理目標 | 用途 |
|---------|---------|------|
| `/api/yahoo-finance` | `https://query1.finance.yahoo.com` | 股票 / 基金報價 |
| `/api/stooq` | `https://stooq.com` | Stooq CSV 報價備援 |

---

## 三、專案目錄結構

```
src/
├── App.tsx                          # 根元件（初始化 seed、Router 入口）
├── main.tsx                         # React 18 createRoot 進入點
├── index.css                        # Tailwind 基礎樣式 + 自訂元件類別
│
├── app/
│   └── router/index.tsx             # React Router 路由設定
│
├── lib/
│   ├── constants.ts                 # 業務常數（幣別、資產類型、市場、交易類型等）
│   ├── formatters.ts                # 格式化工具（貨幣、日期、百分比、月份標籤）
│   └── sorting.ts                   # 通用排序 hook（useSortable）與工具函式（sortByKey）
│
├── stores/
│   └── uiStore.ts                   # Zustand UI 狀態（側欄開關）
│
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx            # Sidebar + TopBar + 主框架
│   └── common/
│       ├── Modal.tsx                # 通用 Modal（sm/md/lg/xl 尺寸）
│       ├── ConfirmDialog.tsx        # 確認對話框（支援 danger 模式）
│       ├── StatCard.tsx             # KPI 統計卡片（含 subValue）
│       ├── SortTh.tsx               # 可排序表格欄位標題元件
│       └── ImportExportButtons.tsx  # 匯出 / 匯入 JSON 按鈕
│
├── data/
│   ├── db.ts                        # Dexie 資料庫定義（9 張資料表，Schema v6）
│   ├── seed.ts                      # 初始資料植入 + 重複分類清理
│   ├── types/index.ts               # TypeScript 介面定義
│   ├── schemas/index.ts             # Zod 驗證 Schema
│   ├── repositories/index.ts        # CRUD 資料存取層
│   └── services/
│       ├── index.ts                 # 商業邏輯計算
│       └── importExport.ts          # JSON 匯出入 + 完整性驗證
│
└── features/
    ├── investment/
    │   ├── InvestmentPage.tsx       # 投資紀錄表主頁（彩色 pill 頁籤 + 匯率面板）
    │   ├── TransactionList.tsx      # 交易清單（篩選 + CRUD + 排序）
    │   ├── AssetManager.tsx         # 資產管理（CRUD + 排序 + 自動更新股價）
    │   ├── AccountManager.tsx       # 帳戶管理（CRUD + 排序 + 轉帳功能）
    │   ├── HoldingStats.tsx         # 持倉統計卡片
    │   └── ExchangeRatePanel.tsx    # 匯率顯示與即時更新面板
    ├── rebalance/
    │   └── RebalancePage.tsx        # 資產再平衡表（圓餅圖 + 目標設定 + 排序）
    └── cashflow/
        └── CashflowPage.tsx         # 收入與日常消費表（全部功能整合）
```

---

## 四、頁面導覽

左側 Sidebar 提供三個主要頁面：

| 路由 | 頁面名稱 |
|------|----------|
| `/investment` | 投資紀錄表 |
| `/rebalance` | 資產再平衡表 |
| `/cashflow` | 收入與日常消費表 |

---

## 五、投資紀錄表（`/investment`）

### 5.1 統計總覽（HoldingStats）

頁面頂部顯示六張統計卡片，數值依交易紀錄篩選條件同步更新（現金與未實現損益除外）：

| 卡片 | 說明 |
|------|------|
| 現金 (TWD) | 所有帳戶餘額換算 TWD 加總（使用即時匯率） |
| 持倉標的數 | 資產管理中非現金類型資產的檔數 |
| 未實現損益 (TWD) | (現價 − 買入均價) × 數量，換算 TWD；正數紅色、負數綠色（台股慣例） |
| 總投入金額 (TWD) | 依篩選條件計算買入成本（剩餘持倉基礎，已扣除賣出部分） |
| 總賣出金額 (TWD) | 依篩選條件計算賣出 + 出金 + 股息金額換算 TWD |
| 已實現損益 (TWD) | 依篩選條件計算已實現損益；正數紅色、負數綠色 |

> 色彩慣例（台股）：正數＝紅色、負數＝綠色。

### 5.2 匯率參考（ExchangeRatePanel）

- 顯示目前儲存的 USD、JPY、CNY 對 TWD 匯率及更新時間
- 匯率儲存方向（v4 起）：**1 外幣 = X TWD**（例如 1 USD ≈ 32 TWD）
- 「更新即時匯率」按鈕呼叫 `open.er-api.com` API 抓取最新匯率並寫入 IndexedDB
- 匯率用於統計卡片及交易紀錄的換算基準

### 5.3 資產管理（AssetManager）

**資產列表欄位**

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

**即時股價抓取（優先順序）**

| 市場 / 類型 | 來源 1 | 來源 2 | 來源 3 |
|------------|--------|--------|--------|
| 台股（TW） | TWSE 官方 API（`mis.twse.com.tw`） | Yahoo Finance（Vite proxy） | Stooq CSV |
| 美股 / 日股 / 陸股 | Yahoo Finance（Vite proxy） | allorigins.win proxy | Stooq CSV |
| 基金（任何市場） | Yahoo Finance（Vite proxy，完整代碼如 `0P0001CN2O`） | allorigins.win proxy | — |
| 現金 / 其他 | 不支援 | — | — |

**批次（Lots）管理**

- 每筆買入交易自動產生一個批次（Lot），記錄買入日期、數量、買入價、匯率
- 批次名稱格式：`{資產名稱} YYYY-MM-DD HH:mm`
- 點擊資產列可展開批次列表；可手動新增 / 刪除批次

**操作**：新增 / 編輯 / 刪除（附確認對話框）、Google Finance 外部連結、欄位排序

### 5.4 帳戶管理（AccountManager）

**帳戶列表欄位**

| 欄位 | 說明 |
|------|------|
| 帳戶名稱 | 自訂名稱 |
| 類型 | `brokerage`（券商）/ `bank`（銀行）/ `cash`（現金） |
| 幣別 | TWD / USD / JPY / CNY |
| 現有資金 | 帳戶餘額；負數顯示綠色 |
| 備註 | 備用說明 |

**轉帳功能**

- 欄位：日期（datetime-local，精確到秒）、轉出帳戶、轉入帳戶、轉出金額、匯率（自動計算，可手動覆寫）、轉入金額（唯讀）、手續費、備註
- 轉帳後自動更新兩個帳戶餘額
- **餘額不足警告**：若轉帳後轉出帳戶餘額 < 0，彈出確認對話框，可選擇繼續或取消

**轉帳紀錄表格欄位**

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

### 5.5 交易紀錄（TransactionList）

**篩選列條件**

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

- 日期：`datetime-local`，精確到秒，預設為當下時間
- 交易類型：買入 / 賣出 / 股息 / 手續費 / 稅費 / 入金 / 出金
- 資產：依幣別篩選可選資產
- 帳戶：依幣別篩選可用帳戶；選擇後顯示該帳戶現有資金
- **單價快捷按鈕**：若資產已設定現價，右側顯示「現價 XXX」按鈕，點擊自動填入
- 幣別、匯率（對 TWD）、數量、手續費、稅費、備註

**賣出 FIFO 邏輯**

- 賣出時依買入批次時間順序（最早優先）扣除數量
- 若資產有批次（Lots）資料，從批次扣除；若無批次但有直接欄位記錄，自動合成一個批次再扣除
- 批次數量扣完後重新計算加權平均買入價

---

## 六、資產再平衡表（`/rebalance`）

| 功能 | 說明 |
|------|------|
| 配置視角切換 | 依資產類型 / 依幣別 兩種視角（各含成本配置與市值配置） |
| 圓餅圖 | Recharts PieChart 顯示當前配置比例 |
| 再平衡建議 | 顯示當前比例、目標比例、差額（TWD）、調整進度條、是否在容忍範圍內 |
| 目標設定 CRUD | 新增 / 編輯 / 刪除各類型目標比例與容忍誤差；所有欄位可排序 |

**目標設定欄位**

| 欄位 | 說明 |
|------|------|
| 標籤 | 自訂名稱 |
| 分類依據 | `assetType`（資產類型）/ `currency`（幣別） |
| 目標鍵值 | 對應的資產類型或幣別代碼 |
| 目標比例 | 0–100% |
| 容許誤差 | ±% |

---

## 七、收入與日常消費表（`/cashflow`）

### 7.1 月份選擇器

- 下拉選單列出「有實際收支紀錄」的月份（不顯示空月份）
- 所有統計卡片與圖表均隨選定月份同步更新

### 7.2 統計卡片（5 張）

| 卡片 | 說明 | 顏色規則 |
|------|------|---------|
| 現金帳戶 (TWD) | 所有 `cash` 類型帳戶餘額換算 TWD 加總（使用即時匯率） | 固定藍色 |
| 月收入 | 選定月份收入加總（換算 TWD） | 固定綠色 |
| 月實際支出 | 選定月份支出加總（換算 TWD） | 固定紅色 |
| 月預計支出 | 固定月支出計畫總額（換算 TWD） | 預設黑色 |
| 月結餘 / 儲蓄率 | 收入 − 支出 / 儲蓄率百分比 | 正數綠色、負數紅色 |

### 7.3 四個子分頁

#### 月度總覽（monthly）

**月收支趨勢長條圖**
- Recharts BarChart，最多顯示最近 12 個月
- 系列：收入（綠色 `#10b981`）、支出（紅色 `#ef4444`）
- 若有固定月支出計畫，顯示橘色虛線 Reference Line 標示計畫支出總額

**支出分類圓餅圖**
- 顯示選定月份各支出分類的金額佔比
- 標籤格式：`{分類名稱} XX.X%`，附帶連線（`labelLine={true}`）
- 圖表區域：高度 380px，左右各留 40px margin，防止標籤被裁切
- 圓心位置：`cy="45%"`（上移，為下方標籤留空間）
- **依金額降冪排列**（最大佔比在最前）

**月度摘要表**

| 欄位 | 顏色規則 |
|------|---------|
| 月份 | 黑色；目前選定月份列高亮（藍色背景） |
| 收入 | 正數綠色（`!text-green-600`）；負數紅色粗體 |
| 實際支出 | 正數黑色；負數紅色粗體 |
| 預計支出 | 正數黑色；負數紅色粗體 |
| 結餘 | 正數綠色（`!text-green-600`）；負數紅色粗體 |
| 儲蓄率 | 正數黑色；負數紅色粗體 |

- 點擊任一列可切換選定月份
- 所有欄位支援點擊排序（`SortTh` 元件）
- 僅顯示有實際收支紀錄的月份（`totalIncome > 0 || totalExpense > 0`）

#### 收支紀錄（records）

**列表欄位**：日期、類型（收入/支出徽章）、分類、金額（收入綠色+號、支出紅色−號）、幣別、備註、操作（編輯/刪除）

**新增 / 編輯收支（Modal）**

| 欄位 | 說明 |
|------|------|
| 日期 | date 選擇器，預設今天 |
| 類型 | 收入 / 支出（切換後分類下拉自動重置） |
| 分類 | 依類型篩選收入分類或支出分類 |
| 金額 | 數字輸入，不可為負數 |
| 幣別 | TWD / USD / JPY / CNY |
| 匯率（對 TWD） | 僅非 TWD 幣別時顯示 |
| 備註 | 文字輸入；下方顯示**最常用前 5 筆備註快捷按鈕**（依出現頻率排序），點擊自動填入 |
| 現金帳戶 | 僅當所選幣別有 `cash` 類型帳戶時顯示；有現金帳戶時**必填**；顯示各帳戶現有餘額 |
| 儲存後餘額預覽 | 選擇帳戶後即時顯示「儲存後餘額：XXX」（編輯模式正確 reverse 舊效果再加新效果） |

**帳戶餘額自動更新邏輯**

| 操作 | 行為 |
|------|------|
| 新增收支 | 直接 apply 至所選帳戶（收入 +，支出 −） |
| 編輯收支 | 先 reverse 舊紀錄帳戶效果，再 apply 新帳戶效果（支援跨帳戶修改） |
| 刪除收支 | 自動 reverse 被刪除紀錄的帳戶效果 |

**匯入固定月計畫（「匯入固定月計畫」按鈕）**

> 按鈕在有固定月計畫時才可用。

1. 選擇匯入日期（預設為當月 1 日）
2. 勾選要匯入的計畫項目（支援全選 checkbox）
3. 收入計畫項目勾選後，可從下拉選擇連結現金帳戶（自動預帶第一個同幣別現金帳戶）
4. 點擊「匯入」後依勾選項目批次建立收支紀錄，並同步更新帳戶餘額

#### 固定月計畫（plans）

分為兩個並排子表格：

**固定月支出計畫**（紅色標題）
- 欄位：分類、計畫金額、幣別、備註、操作（編輯/刪除）
- 新增、編輯、刪除；欄位可排序

**固定月收入計畫**（綠色標題）
- 欄位：分類、計畫金額、幣別、備註、操作（編輯/刪除）
- 新增、編輯、刪除；欄位可排序

> 固定月計畫**不綁定特定月份**（v5 起移除 yearMonth），為全年通用的預算範本。
> 透過「匯入固定月計畫」功能可將計畫轉為指定日期的實際收支紀錄。

**新增 / 編輯計畫欄位**：類型（由來源按鈕決定）、分類、計畫金額、幣別、備註

#### 分類管理（categories）

- 分為收入分類（綠色標題）與支出分類（紅色標題）兩欄
- 分類名稱按繁體中文筆畫排序（`zh-TW-u-co-stroke`）
- 新增、編輯、刪除（附確認對話框）

**預設收入分類（5 項）**：薪資、獎金、股利、利息、其他收入

**預設支出分類（11 項）**：房租、餐飲、交通、水電瓦斯、娛樂、保險、醫療、購物、旅遊、金融投資、其他支出

---

## 八、通用功能

| 功能 | 說明 |
|------|------|
| JSON 匯出 | 將全部資料打包為單一 JSON 檔案下載至本機（`financial_accounting_YYYY-MM-DD.json`） |
| JSON 匯入 | 上傳 JSON 檔案，通過 Zod Schema 驗證 + 外鍵完整性驗證後批次寫入 |
| 離線優先 | 所有資料存於瀏覽器 IndexedDB，無需網路連線 |
| 響應式佈局 | 側邊欄在行動裝置可收合為 Overlay |
| 表格排序 | 所有表格均支援點擊欄位標題升冪 / 降冪排序（`SortTh` 元件 + `useSortable` hook） |
| 確認對話框 | 所有刪除操作均附 `ConfirmDialog`（危險操作顯示紅色按鈕） |

---

## 九、資料層 API 整理

### 9.1 Repository（CRUD 存取層）

所有 Repository 位於 `src/data/repositories/index.ts`：

```typescript
repo.getAll()                                     // 取得全部記錄
repo.getById(id: string)                          // 依 ID 取得單筆
repo.add(input: XxxInput)                         // 新增（自動填入 id / createdAt / updatedAt）
repo.update(id: string, input: Partial<XxxInput>) // 更新（自動更新 updatedAt）
repo.delete(id: string)                           // 刪除
```

| Repository | 對應資料表 |
|-----------|-----------|
| `accountRepo` | `accounts` |
| `assetRepo` | `assets` |
| `investmentTxRepo` | `investmentTransactions` |
| `incomeExpenseRepo` | `incomeExpenseRecords` |
| `monthlyPlanRepo` | `monthlyExpensePlans` |
| `categoryRepo` | `categories` |
| `rebalanceTargetRepo` | `rebalanceTargets` |
| `exchangeRateRepo` | `exchangeRates` |

### 9.2 Service（商業邏輯計算）

位於 `src/data/services/index.ts`：

| 函式 | 輸入 | 輸出 | 說明 |
|------|------|------|------|
| `calcHoldingStats(transactions, assetId)` | 交易陣列、資產 ID | `HoldingStats` | 計算單一資產持倉（均價、成本、已實現損益） |
| `calcAllHoldings(transactions, assets)` | 交易陣列、資產陣列 | `HoldingStats[]` | 計算全部資產持倉 |
| `calcAllocationByAssetType(...)` | 持倉、資產、目標、匯率 | `AllocationItem[]` | 依資產類型計算**成本**配置比例 |
| `calcAllocationByCurrency(...)` | 持倉、資產、目標、匯率 | `AllocationItem[]` | 依幣別計算**成本**配置比例 |
| `calcAllocationByAssetTypeMarketValue(...)` | 持倉、資產、帳戶、目標、匯率 | `AllocationItem[]` | 依資產類型計算**市值**配置比例（含現金帳戶） |
| `calcAllocationByCurrencyMarketValue(...)` | 持倉、資產、帳戶、目標、匯率 | `AllocationItem[]` | 依幣別計算**市值**配置比例（含現金帳戶） |
| `calcMonthlySummaries(records, plans)` | 收支記錄、固定月支出計畫陣列 | `MonthlySummary[]` | 每月收入/支出/計畫支出/結餘/儲蓄率 |
| `calcExpenseByCategory(records, categories, yearMonth?)` | 記錄、分類、月份 | `{categoryName, amount}[]` | 各分類支出加總（可篩選月份） |

### 9.3 Import / Export Service

位於 `src/data/services/importExport.ts`：

| 函式 | 說明 |
|------|------|
| `exportAppData()` | 從 IndexedDB 取出全部資料，組成 `AppData` 物件 |
| `downloadJson(data)` | 觸發瀏覽器下載 JSON 檔案 |
| `importAppData(jsonStr)` | 解析 JSON → Zod 驗證 → 完整性驗證 → 清空後批次寫入 |
| `validateIntegrity(data)` | 檢查外鍵是否都有對應記錄，回傳 `{ valid, errors[] }` |

### 9.4 Sorting 工具（`src/lib/sorting.ts`）

| 函式 / Hook | 說明 |
|------------|------|
| `useSortable(defaultKey, defaultDir?)` | 管理表格排序狀態（sortKey、sortDir、handleSort） |
| `sortByKey<T>(items, key, dir, getValue)` | 泛型排序，支援字串與數字比較 |

---

## 十、IndexedDB Schema（版本歷程）

資料庫名稱：`FinancialAccountingDB`　　目前版本：**v6**

| 版本 | 主要變更 |
|------|---------|
| v1 | 初始 Schema：accounts / assets / investmentTransactions / incomeExpenseRecords / monthlyExpensePlans / categories / rebalanceTargets |
| v2 | 新增 `exchangeRates` 資料表 |
| v3 | 新增 `accountTransfers` 資料表 |
| v4 | 匯率儲存方向改為「1 外幣 = X TWD」（舊資料執行倒數遷移） |
| v5 | 月計畫移除 `yearMonth` 欄位（不再綁定月份，改為全年通用固定計畫） |
| v6 | 月計畫新增 `type` 欄位（`income` \| `expense`，舊資料補上 `'expense'`） |

**目前資料表與索引**

| 資料表 | 主鍵 | 索引欄位 |
|--------|------|---------|
| `accounts` | `id` | `type, currency, name` |
| `assets` | `id` | `assetType, market, currency, ticker, name` |
| `investmentTransactions` | `id` | `date, assetId, accountId, txType, currency` |
| `incomeExpenseRecords` | `id` | `date, type, categoryId, currency` |
| `monthlyExpensePlans` | `id` | `type, categoryId` |
| `categories` | `id` | `type, name` |
| `rebalanceTargets` | `id` | `targetType, targetKey` |
| `exchangeRates` | `id` | — |
| `accountTransfers` | `id` | `date, fromAccountId, toAccountId` |

**常數定義**

| 項目 | 可用值 |
|------|-------|
| 幣別（`CURRENCIES`） | `TWD`, `USD`, `JPY`, `CNY` |
| 資產類型（`ASSET_TYPES`） | `tw_stock`, `us_stock`, `jp_stock`, `cash`, `fund` |
| 市場（`MARKETS`） | `TW`, `US`, `JP`, `CN`, `CASH`, `OTHER` |
| 帳戶類型（`ACCOUNT_TYPES`） | `brokerage`, `bank`, `cash` |
| 收支類型（`CASH_FLOW_TYPES`） | `income`, `expense` |
| 交易類型（`INVESTMENT_TX_TYPES`） | `buy`, `sell`, `dividend`, `fee`, `tax`, `deposit`, `withdrawal` |

---

## 十一、JSON 匯出入格式

### 11.1 檔案位置

JSON 備份檔案由**使用者自行決定存放位置**（瀏覽器下載至本機）。匯入時透過「匯入 JSON」按鈕選取本機檔案。

> 程式碼中不存在固定的 JSON 目錄；所有即時資料皆存於瀏覽器 **IndexedDB**。

### 11.2 完整結構

```jsonc
{
  "meta": {
    "version": "1.0.0",
    "lastModified": "2025-07-15T00:00:00.000Z",
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
      "quantity": 1000,
      "buyPrice": 850.0,
      "fxRateToBase": 1.0,
      "currentPrice": 920.0,
      "note": "備註",
      "lots": [
        {
          "id": "uuid",
          "name": "台積電 2025-01-15 09:30",
          "buyPrice": 850.0,
          "fxRateToBase": 1.0,
          "buyDate": "2025-01-15",
          "quantity": 1000
        }
      ],
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "investmentTransactions": [
    {
      "id": "uuid",
      "date": "YYYY-MM-DD HH:mm:ss",
      "assetId": "uuid",
      "accountId": "uuid",
      "txType": "buy",           // "buy" | "sell" | "dividend" | "fee" | "tax" | "deposit" | "withdrawal"
      "quantity": 1000,
      "price": 850.0,
      "currency": "TWD",
      "fxRateToBase": 1.0,       // 交易當時的匯率（1 外幣 = X TWD）
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
      "accountId": "uuid",       // 選填，關聯現金帳戶 ID
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
      "type": "expense",         // "income" | "expense"（v6 新增；舊資料預設 "expense"）
      "categoryId": "uuid",
      "plannedAmount": 10000,
      "currency": "TWD",
      "note": "備註",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
      // 注意：v5 起已移除 yearMonth 欄位
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
  ],
  "accountTransfers": [
    {
      "id": "uuid",
      "date": "YYYY-MM-DD HH:mm:ss",
      "fromAccountId": "uuid",
      "toAccountId": "uuid",
      "fromAmount": 1000,
      "toAmount": 32000,
      "fxRate": 32.0,
      "fee": 0,
      "note": "備註",
      "fromBalanceAfter": 9000,
      "toBalanceAfter": 132000,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

---

## 十二、計算公式與邏輯說明

### 12.1 匯率取得規則

#### 即時匯率（`getFx`）

```
getFx(currency):
  TWD → 1
  USD → exchangeRate.usdRate  (1 USD = X TWD，v4 起)
  JPY → exchangeRate.jpyRate
  CNY → exchangeRate.cnyRate
  其他 / 無匯率 → 1
```

#### 交易成本匯率（`fx`）

```
fx = tx.fxRateToBase > 0 ? tx.fxRateToBase : getFx(tx.currency)
```

#### 資產成本匯率（`costFx`）

`asset.fxRateToBase` 為所有批次的數量加權平均成本匯率，每次新增/賣出/編輯批次後自動重算並持久化。

```
costFx = asset.fxRateToBase > 0 ? asset.fxRateToBase : getFx(asset.currency)
```

---

### 12.2 投資紀錄表統計卡片

#### 現金 (TWD)
```
totalBalanceTWD = Σ (acc.balance × getFx(acc.currency))
```

#### 總投入金額（語意：剩餘持倉成本基礎）
```
buy / deposit:     b.cost += qty × price × fx + (fee + tax) × fx
sell / withdrawal: costOfSold = (b.cost / b.qty) × qty_sold; b.cost -= costOfSold
fee / tax:         b.cost += (fee + tax) × fx
totalCostTWD = Σ b.cost
```
> 此值為「已買入但尚未賣出的成本基礎」，非歷史累計買入總額。

#### 總賣出金額
```
sell / withdrawal / dividend: totalSellTWD += qty × price × fx
```

#### 已實現損益
```
sell / withdrawal: b.pnl += (qty × price × fx) - (fee + tax) × fx - costOfSold
dividend:          b.pnl += (qty × price × fx) - (fee + tax) × fx
totalRealizedPnL = Σ b.pnl
```

#### 未實現損益
```
totalUnrealizedPnLTWD = Σ (
  currentPrice × qty × getFx(asset.currency)  ← 現值（即時匯率）
  - buyPrice × qty × costFx                   ← 成本（成本匯率）
)
```

---

### 12.3 資產再平衡配置計算

#### 成本配置（不含帳戶現金）
```
per asset (qty > 0):
  cost_TWD = buyPrice × qty × costFx
```

#### 市值配置（含帳戶現金）
```
per asset (qty > 0 && currentPrice > 0):
  mv_TWD = currentPrice × qty × getFx(currency)

// 依資產類型：現金帳戶統一歸入 'cash' bucket
// 依幣別：現金帳戶按原始幣別分入對應 bucket
per account:
  amountByType['cash'] += balance × getFx(acc.currency)
  amountByCurrency[acc.currency] += balance × getFx(acc.currency)
```

#### AllocationItem 共通欄位

| 欄位 | 公式 |
|------|------|
| `currentPercent` | `amt / totalTWD` |
| `targetAmountTWD` | `targetPercent × totalTWD` |
| `diffAmountTWD` | `targetAmountTWD - amt`（正 = 需買入，負 = 超額） |
| `isWithinTolerance` | `|currentPercent - targetPercent| <= tolerancePercent` |

---

### 12.4 收支月度摘要計算

```
calcMonthlySummaries(records, plans)
// plans 僅傳入 type === 'expense' 的固定月計畫

MonthlySummary {
  yearMonth:           string  // YYYY-MM
  totalIncome:         number  // 當月收入加總（amount × fxRateToBase 換算 TWD）
  totalExpense:        number  // 當月支出加總（換算 TWD）
  totalPlannedExpense: number  // 固定月支出計畫合計（換算 TWD）
  balance:             number  // totalIncome - totalExpense
  savingsRate:         number  // balance / totalIncome（totalIncome = 0 時為 0）
}
```

### 12.5 支出分類圓餅圖排序

```typescript
// CashflowPage.tsx 中排序邏輯
const expenseByCat = useMemo(
  () => calcExpenseByCategory(records, categories, selectedMonth)
        .sort((a, b) => b.amount - a.amount),
  [records, categories, selectedMonth]
)
```

---

## 十三、技術注意事項

| 項目 | 說明 |
|------|------|
| CSS 優先度 | `src/index.css` 中 `.table td` 規則優先度高於單一 Tailwind utility；`<td>` 內顏色覆寫須使用 `!text-*` 前綴（如 `!text-red-500`、`!text-green-600`） |
| 匯率儲存方向 | v4 起：`usdRate` 儲存「1 USD = X TWD」（約 32）；v1–v3 舊版儲存「1 TWD = X USD」（約 0.031），升級遷移時已自動取倒數 |
| 月計畫無月份 | v5 起 `monthlyExpensePlans` 移除 `yearMonth` 欄位；計畫為全年通用，需透過「匯入固定月計畫」功能才能轉為實際收支紀錄 |
| 月計畫類型 | v6 起 `monthlyExpensePlans.type` 欄位可為 `income` 或 `expense`；舊資料無此欄位時 fallback `'expense'` |
| 資料初始化 | 首次啟動呼叫 `seedIfEmpty()` 注入預設分類與示範資料；重複分類自動清理 |
| 帳戶餘額一致性 | 所有收支新增/編輯/刪除操作均透過 `applyAccountBalance()` 函式同步更新現金帳戶餘額 |
| 備註快捷按鈕 | 從所有歷史收支紀錄中統計最常出現的 5 筆備註並顯示為快捷按鈕（僅在收支 Modal 內） |

---

*本文件由 GitHub Copilot 依程式碼自動生成，最後更新：2025-07-15*
