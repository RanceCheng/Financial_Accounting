// ============================================================
// 投資績效分析 Service（以資產管理資料為基礎）
// ============================================================
import { Asset, ExchangeRate } from '@/data/types'
import { Currency } from '@/lib/constants'
import {
  InvestmentAnalysisSummary,
  AssetAnalysisRow,
  FundAnalysisRow,
  InvestmentWarning,
} from '@/features/investmentAnalysis/types/investmentAnalysis'

// ── 匯率輔助 ─────────────────────────────────────────────
function getFx(er: ExchangeRate | undefined, currency: Currency | string): number {
  if (!er) return 1
  if (currency === 'TWD') return 1
  if (currency === 'USD' && er.usdRate > 0) return er.usdRate
  if (currency === 'JPY' && er.jpyRate > 0) return er.jpyRate
  if (currency === 'CNY' && er.cnyRate > 0) return er.cnyRate
  return 1
}

// ── 計算總投資市值（排除 cash，使用資產的 quantity × currentPrice）────────────────────────────
export function getTotalInvestmentMarketValueTWD(
  assets: Asset[],
  exchangeRate: ExchangeRate | undefined
): number {
  return assets
    .filter(a => a.assetType !== 'cash')
    .reduce((total, asset) => {
      const qty = asset.quantity ?? 0
      if (qty <= 0) return total
      const price = asset.currentPrice ?? 0
      const fx = getFx(exchangeRate, asset.currency)
      return total + qty * price * fx
    }, 0)
}

// ── 以批次（lots）計算精確成本基礎（TWD）────────────────
// qty × avgBuyPrice × avgFxRate 會因各批次匯率不同而產生誤差，
// 正確做法是對每批次個別計算再加總。
function calcCostBasisTWD(asset: Asset, fallbackFx: number): number {
  if (asset.lots && asset.lots.length > 0) {
    return asset.lots.reduce((sum, lot) => {
      const lotQty   = lot.quantity ?? 0
      const lotPrice = lot.buyPrice ?? 0
      const lotFx    = (lot.fxRateToBase != null && lot.fxRateToBase > 0) ? lot.fxRateToBase : fallbackFx
      return sum + lotQty * lotPrice * lotFx
    }, 0)
  }
  // 無批次：以 asset 欄位計算
  const qty      = asset.quantity ?? 0
  const price    = asset.buyPrice ?? 0
  const assetFx  = (asset.fxRateToBase != null && asset.fxRateToBase > 0) ? asset.fxRateToBase : fallbackFx
  return qty * price * assetFx
}

// ── 原幣成本基礎（不含匯率換算，供殖利率分母使用）────────────────────────────────────────────────────────────
function calcCostBasisOC(asset: Asset): number {
  if (asset.lots && asset.lots.length > 0) {
    return asset.lots.reduce((sum, lot) => sum + (lot.quantity ?? 0) * (lot.buyPrice ?? 0), 0)
  }
  return (asset.quantity ?? 0) * (asset.buyPrice ?? 0)
}

// ── 一般標的分析列（以資產管理的 quantity/buyPrice/fxRateToBase 為基礎）────────────────────────────────────────
export function calculateAssetAnalysisRows(
  assets: Asset[],
  exchangeRate: ExchangeRate | undefined,
  totalInvestmentMarketValueTWD: number,
  dividendsByTicker: Map<string, number> = new Map()
): AssetAnalysisRow[] {
  return assets
    .filter(a => a.assetType !== 'cash' && a.assetType !== 'fund')
    .map(asset => {
      const qty          = asset.quantity  ?? 0
      const buyPrice     = asset.buyPrice  ?? 0
      const currentFx    = getFx(exchangeRate, asset.currency)
      const currentPrice = asset.currentPrice ?? 0

      const costBasisTWD             = calcCostBasisTWD(asset, currentFx)
      const marketValueTWD           = qty * currentPrice * currentFx
      const unrealizedPnLTWD         = marketValueTWD - costBasisTWD
      const unrealizedReturnRate     = costBasisTWD > 0 ? unrealizedPnLTWD / costBasisTWD : 0
      const totalNetDistributionsTWD = dividendsByTicker.get(asset.ticker) ?? 0
      const totalReturnTWD           = unrealizedPnLTWD + totalNetDistributionsTWD
      const totalReturnRate          = costBasisTWD > 0 ? totalReturnTWD / costBasisTWD : 0
      const portfolioWeight          = totalInvestmentMarketValueTWD > 0 ? marketValueTWD / totalInvestmentMarketValueTWD : 0

      const row: AssetAnalysisRow = {
        assetId: asset.id,
        name: asset.name,
        ticker: asset.ticker,
        assetType: asset.assetType,
        market: asset.market,
        currency: asset.currency,
        quantity: qty,
        averageCost: buyPrice,
        currentPrice,
        costBasisTWD,
        marketValueTWD,
        unrealizedPnLTWD,
        unrealizedReturnRate,
        realizedCapitalGainTWD: 0,
        totalNetDistributionsTWD,
        totalReturnTWD,
        totalReturnRate,
        portfolioWeight,
        warnings: [],
      }
      row.warnings = generateInvestmentWarnings(row, { isFund: false, totalInvestmentMarketValueTWD })
      return row
    })
}

// ── 基金分析列（以資產管理的 quantity/buyPrice/fxRateToBase 為基礎）────────────────────────────────────────────
export function calculateFundAnalysisRows(
  assets: Asset[],
  exchangeRate: ExchangeRate | undefined,
  totalInvestmentMarketValueTWD: number,
  distributionsByTicker: Map<string, number> = new Map(),
  trailing12ByTicker: Map<string, number> = new Map()
): FundAnalysisRow[] {
  return assets
    .filter(a => a.assetType === 'fund')
    .map(asset => {
      const qty          = asset.quantity  ?? 0
      const buyPrice     = asset.buyPrice  ?? 0
      const currentFx    = getFx(exchangeRate, asset.currency)
      const currentPrice = asset.currentPrice ?? 0

      const costBasisTWD               = calcCostBasisTWD(asset, currentFx)
      const marketValueTWD             = qty * currentPrice * currentFx
      const navPnLTWD                  = marketValueTWD - costBasisTWD
      const navReturnRate              = costBasisTWD > 0 ? navPnLTWD / costBasisTWD : 0
      const portfolioWeight            = totalInvestmentMarketValueTWD > 0 ? marketValueTWD / totalInvestmentMarketValueTWD : 0

      // 原幣成本／市值（供殖利率公式分母）
      const costBasisOC                = calcCostBasisOC(asset)
      const marketValueOC              = qty * currentPrice

      // 配息資料（來自收支紀錄基金利息，原幣）
      const totalNetDistributionsOC    = distributionsByTicker.get(asset.ticker) ?? 0
      const trailing12OC               = trailing12ByTicker.get(asset.ticker) ?? 0

      // 含息報酬仍以 TWD 計算（供摘要統計和含息報酬欄位使用）
      const totalNetDistributionsTWD   = totalNetDistributionsOC * currentFx
      const totalReturnWithDistributionTWD  = navPnLTWD + totalNetDistributionsTWD
      const totalReturnWithDistributionRate = costBasisTWD > 0 ? totalReturnWithDistributionTWD / costBasisTWD : 0

      // 殖利率相關：分子分母統一用原幣
      const distributionReturnRate          = costBasisOC > 0 ? totalNetDistributionsOC / costBasisOC : 0
      const yieldOnCost                     = costBasisOC > 0 ? trailing12OC / costBasisOC : 0
      const trailing12MonthYield            = marketValueOC > 0 ? trailing12OC / marketValueOC : 0

      const totalReturnTWD             = totalReturnWithDistributionTWD
      const totalReturnRate            = costBasisTWD > 0 ? totalReturnTWD / costBasisTWD : 0

      const row: FundAnalysisRow = {
        assetId: asset.id,
        name: asset.name,
        ticker: asset.ticker,
        assetType: asset.assetType,
        market: asset.market,
        currency: asset.currency,
        quantity: qty,
        averageCost: buyPrice,
        currentPrice,
        costBasisTWD,
        marketValueTWD,
        unrealizedPnLTWD: navPnLTWD,
        unrealizedReturnRate: navReturnRate,
        realizedCapitalGainTWD: 0,
        totalNetDistributionsTWD,   // TWD: 供含息報酬和摘要統計
        totalNetDistributionsOC,     // 原幣: 供表格顯示和殖利率計算
        totalReturnTWD,
        totalReturnRate,
        portfolioWeight,
        navPnLTWD,
        navReturnRate,
        distributionReturnRate,
        totalReturnWithDistributionTWD,
        totalReturnWithDistributionRate,
        trailing12MonthNetDistributionsTWD: trailing12OC,  // 原幣（欄位名沿用）
        trailing12MonthYield,
        yieldOnCost,
        distributionCount: 0,
        lastDistributionDate: undefined,
        warnings: [],
      }
      row.warnings = generateInvestmentWarnings(row, { isFund: true, totalInvestmentMarketValueTWD })
      return row
    })
}

// ── 摘要 KPI ─────────────────────────────────────────────
export function calculateInvestmentAnalysisSummary(
  assetRows: AssetAnalysisRow[],
  fundRows: FundAnalysisRow[]
): InvestmentAnalysisSummary {
  const all = [...assetRows, ...fundRows]
  const totalMarketValueTWD = all.reduce((s, r) => s + r.marketValueTWD, 0)
  const totalCostTWD = all.reduce((s, r) => s + r.costBasisTWD, 0)
  const unrealizedPnLTWD = all.reduce((s, r) => s + r.unrealizedPnLTWD, 0)
  const totalReturnTWD = unrealizedPnLTWD
  const totalReturnRate = totalCostTWD > 0 ? totalReturnTWD / totalCostTWD : 0
  return {
    totalMarketValueTWD,
    totalCostTWD,
    unrealizedPnLTWD,
    realizedCapitalGainTWD: 0,
    totalNetDistributionsTWD: fundRows.reduce((s, r) => s + r.totalNetDistributionsTWD, 0),
    totalReturnTWD,
    totalReturnRate,
    holdingAssetCount: all.filter(r => r.quantity > 0).length,
    fundCount: fundRows.filter(r => r.quantity > 0).length,
    nonFundAssetCount: assetRows.filter(r => r.quantity > 0).length,
  }
}

// ── 風險警示產生 ──────────────────────────────────────────
export function generateInvestmentWarnings(
  row: AssetAnalysisRow | FundAnalysisRow,
  context: { isFund: boolean; totalInvestmentMarketValueTWD: number }
): InvestmentWarning[] {
  const warnings: InvestmentWarning[] = []

  if (!row.currentPrice || row.currentPrice <= 0) {
    warnings.push({ code: 'MISSING_CURRENT_PRICE', level: 'warning', message: '缺少現價，市值與報酬率可能不準確。' })
  }

  if (context.isFund) {
    const fund = row as FundAnalysisRow
    if (fund.navReturnRate <= -0.25) {
      warnings.push({ code: 'NAV_DRAWDOWN_25', level: 'danger', message: '基金淨值跌幅超過 25%，需重新評估持有理由。', metric: fund.navReturnRate })
    } else if (fund.navReturnRate <= -0.15) {
      warnings.push({ code: 'NAV_DRAWDOWN_15', level: 'warning', message: '基金淨值跌幅超過 15%。', metric: fund.navReturnRate })
    }
    if (fund.portfolioWeight >= 0.25) {
      warnings.push({ code: 'SINGLE_FUND_WEIGHT_HIGH', level: 'warning', message: '單一基金占投資市值超過 25%。', metric: fund.portfolioWeight })
    }
  } else {
    if (row.portfolioWeight >= 0.30) {
      warnings.push({ code: 'SINGLE_ASSET_WEIGHT_HIGH', level: 'warning', message: '單一標的占投資市值超過 30%。', metric: row.portfolioWeight })
    }
  }

  if (row.totalReturnRate < 0) {
    warnings.push({ code: 'NEGATIVE_TOTAL_RETURN', level: 'warning', message: '此標的總報酬為負。', metric: row.totalReturnRate })
  }

  return warnings
}
