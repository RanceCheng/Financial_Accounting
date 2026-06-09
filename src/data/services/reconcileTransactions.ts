// ============================================================
// 交易紀錄對帳：依買入/賣出交易（FIFO）重建資產批次與數量
// 確保「資產管理」的數量與「交易紀錄」一致
// ============================================================
import { Asset, AssetLot, InvestmentTransaction } from '@/data/types'
import { v4 as uuidv4 } from 'uuid'

export interface ReconcileResult {
  assetId: string
  name: string
  ticker: string
  // updated=已依交易修正；unchanged=已一致；needsReview=有持有但無買入紀錄(待使用者確認是否刪除)；skipped=無持有亦無交易
  status: 'updated' | 'unchanged' | 'needsReview' | 'skipped'
  buyCount: number
  sellCount: number
  beforeQty?: number
  afterQty?: number
  patch?: { lots: AssetLot[]; quantity?: number; buyPrice: number; fxRateToBase?: number }
}

function formatLotDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 從批次列表計算加權平均買入價、數量總和、加權平均成本匯率
function calcLotsStats(lots: AssetLot[]): { quantity: number | undefined; buyPrice: number; fxRateToBase: number | undefined } {
  const totalQty = lots.reduce((s, l) => s + (l.quantity ?? 0), 0)
  const withBoth = lots.filter(l => l.quantity != null && l.quantity > 0 && l.buyPrice != null)
  const weightedSum = withBoth.reduce((s, l) => s + l.buyPrice! * l.quantity!, 0)
  const qtyForWA = withBoth.reduce((s, l) => s + l.quantity!, 0)
  const withFx = lots.filter(l => l.fxRateToBase != null && l.fxRateToBase > 0 && (l.quantity ?? 0) > 0)
  const fxWeightedSum = withFx.reduce((s, l) => s + l.fxRateToBase! * (l.quantity ?? 0), 0)
  const fxQty = withFx.reduce((s, l) => s + (l.quantity ?? 0), 0)
  return {
    quantity: totalQty > 0 ? totalQty : undefined,
    buyPrice: qtyForWA > 0 ? weightedSum / qtyForWA : 0,
    fxRateToBase: fxQty > 0 ? parseFloat((fxWeightedSum / fxQty).toFixed(4)) : undefined,
  }
}

/**
 * 依交易紀錄重建每個資產的批次與數量。
 * - 有買入紀錄的資產：依交易 FIFO 重建批次與數量（status=updated/unchanged）。
 * - 有持有數量但「沒有任何買入紀錄」：不自動更動，標記 needsReview 交由使用者確認是否刪除。
 * - 既無持有也無交易：標記 skipped。
 * - 買入：依交易時間新增批次；賣出：FIFO 從最舊批次扣除。
 * - status 為 updated 時提供 patch，呼叫端負責寫入資料庫。
 */
export function reconcileAssetsFromTransactions(
  assets: Asset[],
  transactions: InvestmentTransaction[]
): ReconcileResult[] {
  const txByAsset = new Map<string, InvestmentTransaction[]>()
  for (const tx of transactions) {
    if (tx.txType !== 'buy' && tx.txType !== 'sell') continue
    if (!txByAsset.has(tx.assetId)) txByAsset.set(tx.assetId, [])
    txByAsset.get(tx.assetId)!.push(tx)
  }

  return assets.map(asset => {
    const txs = (txByAsset.get(asset.id) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date))
    const buyCount = txs.filter(t => t.txType === 'buy').length
    const sellCount = txs.filter(t => t.txType === 'sell').length
    const hasHoldings = (asset.quantity ?? 0) > 0 || (asset.lots?.length ?? 0) > 0

    // 沒有任何買入紀錄：無法依交易重建持有數量
    if (buyCount === 0) {
      // 有持有數量卻無買入紀錄 → 交由使用者確認是否刪除，絕不自動更動或清空
      return {
        assetId: asset.id, name: asset.name, ticker: asset.ticker,
        status: hasHoldings ? 'needsReview' : 'skipped',
        buyCount, sellCount, beforeQty: asset.quantity,
      }
    }

    // 依交易時間順序重建批次
    let lots: AssetLot[] = []
    for (const tx of txs) {
      if (tx.txType === 'buy') {
        lots.push({
          id: uuidv4(),
          name: `${asset.name} ${formatLotDate(tx.date)}`,
          buyPrice: tx.price,
          fxRateToBase: tx.fxRateToBase > 0 ? tx.fxRateToBase : undefined,
          buyDate: tx.date,
          quantity: tx.quantity,
        })
      } else {
        // 賣出：FIFO 從最舊批次扣除
        let remaining = tx.quantity
        const sortedLots = lots.slice().sort((a, b) => a.buyDate.localeCompare(b.buyDate))
        const updated: AssetLot[] = []
        for (const lot of sortedLots) {
          const lotQty = lot.quantity ?? 0
          if (remaining <= 0) {
            updated.push(lot)
          } else if (lotQty <= remaining) {
            remaining -= lotQty // 整批賣出，丟棄
          } else {
            updated.push({ ...lot, quantity: lotQty - remaining })
            remaining = 0
          }
        }
        lots = updated
      }
    }

    const stats = calcLotsStats(lots)
    const beforeQty = asset.quantity
    const afterQty = stats.quantity

    const qtyChanged = (beforeQty ?? 0) !== (afterQty ?? 0)
    const priceChanged = Math.abs((asset.buyPrice ?? 0) - stats.buyPrice) > 1e-9
    const lotCountChanged = (asset.lots?.length ?? 0) !== lots.length
    const changed = qtyChanged || priceChanged || lotCountChanged

    return {
      assetId: asset.id, name: asset.name, ticker: asset.ticker,
      status: changed ? 'updated' : 'unchanged',
      buyCount, sellCount, beforeQty, afterQty,
      patch: changed ? { lots, quantity: stats.quantity, buyPrice: stats.buyPrice, fxRateToBase: stats.fxRateToBase } : undefined,
    }
  })
}
