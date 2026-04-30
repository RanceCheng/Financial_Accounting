import { AssetType, Market, Currency } from '@/lib/constants'

// ── 警示 ──────────────────────────────────────────────────
export type InvestmentWarningLevel = 'info' | 'warning' | 'danger'

export interface InvestmentWarning {
  code: string
  level: InvestmentWarningLevel
  message: string
  metric?: number
}

// ── 頁面摘要 KPI ─────────────────────────────────────────
export interface InvestmentAnalysisSummary {
  totalMarketValueTWD: number
  totalCostTWD: number
  unrealizedPnLTWD: number
  realizedCapitalGainTWD: number
  totalNetDistributionsTWD: number
  totalReturnTWD: number
  totalReturnRate: number
  holdingAssetCount: number
  fundCount: number
  nonFundAssetCount: number
}

// ── 一般標的分析列 ────────────────────────────────────────
export interface AssetAnalysisRow {
  assetId: string
  name: string
  ticker: string
  assetType: AssetType
  market: Market
  currency: Currency
  quantity: number
  averageCost: number       // 原幣每單位平均成本
  currentPrice: number
  costBasisTWD: number
  marketValueTWD: number
  unrealizedPnLTWD: number
  unrealizedReturnRate: number
  realizedCapitalGainTWD: number
  totalNetDistributionsTWD: number
  totalReturnTWD: number
  totalReturnRate: number
  portfolioWeight: number
  warnings: InvestmentWarning[]
}

// ── 基金分析列（繼承一般標的）────────────────────────────
export interface FundAnalysisRow extends AssetAnalysisRow {
  navPnLTWD: number
  navReturnRate: number
  totalNetDistributionsOC: number           // 累積淨配息（原幣，供表格顯示與殖利率計算）
  distributionReturnRate: number
  totalReturnWithDistributionTWD: number
  totalReturnWithDistributionRate: number
  trailing12MonthNetDistributionsTWD: number  // 近12月配息（原幣，欄位名沿用）
  trailing12MonthYield: number
  yieldOnCost: number
  distributionCount: number
  lastDistributionDate?: string
}

