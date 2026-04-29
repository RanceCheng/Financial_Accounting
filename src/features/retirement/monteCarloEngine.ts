// ============================================================
// 退休蒙地卡羅模擬引擎
// ============================================================

export interface SimParams {
  currentAge: number         // 目前年齡
  retireAge: number          // 退休年齡
  lifeExpectancy: number     // 預期壽命
  currentAssets: number      // 目前總資產 (TWD)
  monthlyInvestment: number  // 退休前每月投入 (TWD)
  annualReturn: number       // 年化預期報酬率（小數，如 0.07 代表 7%）
  annualVolatility: number   // 年化波動率/標準差（小數）
  monthlyExpense: number     // 退休後每月支出（今日幣值，TWD）
  inflationRate: number      // 通膨率（小數）
  simCount: number           // 模擬次數
}

export interface ChartPoint {
  age: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface SimResult {
  successRate: number              // 壽命內資產不歸零的模擬比例
  retireMedianAsset: number        // 退休時資產中位數 (TWD)
  depletionMedianAge: number | null // 資產耗盡的中位年齡（> 50% 失敗才顯示）
  chartData: ChartPoint[]
}

// Box-Muller 常態分佈亂數
function normalRandom(mean: number, std: number): number {
  const u1 = Math.max(Math.random(), 1e-15)
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + std * z
}

// 排序後陣列的第 p 百分位數（線性插值）
function pctile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function runMonteCarlo(params: SimParams): SimResult {
  const {
    currentAge, retireAge, lifeExpectancy,
    currentAssets, monthlyInvestment,
    annualReturn, annualVolatility,
    monthlyExpense, inflationRate,
    simCount,
  } = params

  const totalYears    = lifeExpectancy - currentAge
  const preRetireYrs  = retireAge - currentAge
  const monthlyMean   = annualReturn / 12
  const monthlyStd    = annualVolatility / Math.sqrt(12)

  // allPaths[sim][year] = 資產值（year 0 = 現在）
  const allPaths: Float64Array[] = new Array(simCount)
  let successCount = 0
  const depletionAges: number[] = []

  for (let sim = 0; sim < simCount; sim++) {
    const path = new Float64Array(totalYears + 1)
    let asset = currentAssets
    path[0] = asset
    let depleted = false

    for (let y = 1; y <= totalYears; y++) {
      if (depleted) {
        path[y] = 0
        continue
      }
      for (let m = 0; m < 12; m++) {
        const r = normalRandom(monthlyMean, monthlyStd)
        asset *= (1 + r)

        if (y <= preRetireYrs) {
          // 退休前：每月定期投入
          asset += monthlyInvestment
        } else {
          // 退休後：每月支出（含通膨調整）
          const monthsSinceRetire = (y - preRetireYrs - 1) * 12 + m
          const inflatedExpense = monthlyExpense * Math.pow(1 + inflationRate / 12, monthsSinceRetire)
          asset -= inflatedExpense
          if (asset <= 0) {
            asset = 0
            depleted = true
            depletionAges.push(currentAge + y)
            break
          }
        }
      }
      path[y] = asset
    }

    allPaths[sim] = path
    if (!depleted) successCount++
  }

  // 計算每年的百分位數
  const yearlyVals = new Array<number>(simCount)
  const chartData: ChartPoint[] = []

  for (let y = 0; y <= totalYears; y++) {
    for (let s = 0; s < simCount; s++) yearlyVals[s] = allPaths[s][y]
    yearlyVals.sort((a, b) => a - b)
    chartData.push({
      age: currentAge + y,
      p10: Math.max(0, pctile(yearlyVals, 10)),
      p25: Math.max(0, pctile(yearlyVals, 25)),
      p50: Math.max(0, pctile(yearlyVals, 50)),
      p75: Math.max(0, pctile(yearlyVals, 75)),
      p90: Math.max(0, pctile(yearlyVals, 90)),
    })
  }

  const retireMedianAsset = chartData[preRetireYrs]?.p50 ?? 0
  let depletionMedianAge: number | null = null
  if (depletionAges.length > simCount * 0.5) {
    depletionAges.sort((a, b) => a - b)
    depletionMedianAge = Math.round(pctile(depletionAges, 50))
  }

  return { successRate: successCount / simCount, retireMedianAsset, depletionMedianAge, chartData }
}
