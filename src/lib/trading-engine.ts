// 交易引擎：条件单创建、买入成交、卖出成交

import { db, type PendingOrder, type ActivePosition } from './db'
import { notifyOrderCreated, notifyBuyExecuted, notifySellExecuted } from './notify'
import type { AnalysisResult } from './ai'

const FEE_RATE = 0.0001 // 万1手续费

// ===== 条件单创建 =====

export async function createOrdersFromAnalysis(
  analysisId: number,
  orders: AnalysisResult['orders'],
  portfolioId: number
): Promise<number[]> {
  const createdIds: number[] = []

  for (const order of orders) {
    if (order.direction !== 'buy') continue

    // 检查是否已有该 ETF 的持仓
    const existingPosition = await db.activePositions
      .where({ portfolio_id: portfolioId, code: order.code, status: 'holding' })
      .first()
    if (existingPosition) continue

    // 取消同 ETF 同方向的 pending 旧单 (superseded)
    await db.pendingOrders
      .where({ portfolio_id: portfolioId, code: order.code, status: 'pending' })
      .modify({ status: 'cancelled', cancel_reason: 'superseded' })

    // 创建新条件单
    const id = await db.pendingOrders.add({
      portfolio_id: portfolioId,
      analysis_id: analysisId,
      code: order.code,
      name: order.name,
      direction: 'buy',
      trigger_price: order.trigger_price,
      position_pct: order.position_pct,
      stop_loss_pct: order.stop_loss_pct,
      trailing_pct: order.trailing_pct,
      activation_pct: order.activation_pct,
      max_hold_days: order.max_hold_days,
      reason: order.reason,
      status: 'pending',
      cancel_reason: null,
      executed_price: null,
      executed_shares: null,
      executed_at: null,
      created_at: new Date().toISOString(),
    })

    createdIds.push(id as number)
    notifyOrderCreated(order.name, order.code, order.trigger_price)
  }

  return createdIds
}

// ===== 买入成交 =====

export async function executeBuy(order: PendingOrder, currentPrice: number): Promise<void> {
  const portfolio = await db.portfolios.get(order.portfolio_id)
  if (!portfolio) return

  const totalAsset = portfolio.cash
  const amount = totalAsset * (order.position_pct / 100)
  const shares = Math.floor(amount / currentPrice / 100) * 100
  if (shares <= 0) return

  const cost = shares * currentPrice
  const fee = Math.max(cost * FEE_RATE, 0.1)
  const totalCost = cost + fee

  if (totalCost > portfolio.cash) return

  const now = new Date().toISOString()
  const today = now.split('T')[0]

  await db.transaction('rw', [db.portfolios, db.pendingOrders, db.activePositions, db.trades], async () => {
    await db.portfolios.update(order.portfolio_id, {
      cash: portfolio.cash - totalCost,
    })

    await db.pendingOrders.update(order.id!, {
      status: 'executed',
      executed_price: currentPrice,
      executed_shares: shares,
      executed_at: now,
    })

    const positionId = await db.activePositions.add({
      portfolio_id: order.portfolio_id,
      order_id: order.id!,
      analysis_id: order.analysis_id,
      code: order.code,
      name: order.name,
      buy_price: currentPrice,
      shares,
      remaining_shares: shares,
      highest_price: currentPrice,
      buy_date: today,
      stop_loss_pct: order.stop_loss_pct,
      trailing_pct: order.trailing_pct,
      activation_pct: order.activation_pct,
      max_hold_days: order.max_hold_days,
      status: 'holding',
      close_reason: null,
      close_price: null,
      close_date: null,
      pnl: null,
      pnl_pct: null,
    })

    await db.trades.add({
      portfolio_id: order.portfolio_id,
      code: order.code,
      name: order.name,
      direction: 'buy',
      shares,
      price: currentPrice,
      fee,
      reason: 'signal',
      order_id: order.id!,
      position_id: positionId as number,
      date: today,
      created_at: now,
    })
  })

  notifyBuyExecuted(order.name, order.code, currentPrice, shares)
}

// ===== 卖出成交 =====

export async function executeSell(
  position: ActivePosition,
  currentPrice: number,
  sellShares: number,
  reason: ActivePosition['close_reason']
): Promise<void> {
  const portfolio = await db.portfolios.get(position.portfolio_id)
  if (!portfolio) return
  if (sellShares <= 0) return

  const revenue = sellShares * currentPrice
  const fee = Math.max(revenue * FEE_RATE, 0.1)
  const netRevenue = revenue - fee

  const now = new Date().toISOString()
  const today = now.split('T')[0]

  const newRemaining = position.remaining_shares - sellShares
  const isFull = newRemaining <= 0

  const pnlPct = ((currentPrice - position.buy_price) / position.buy_price) * 100

  await db.transaction('rw', [db.portfolios, db.activePositions, db.trades], async () => {
    await db.portfolios.update(position.portfolio_id, {
      cash: portfolio.cash + netRevenue,
    })

    if (isFull) {
      const totalPnl = (currentPrice - position.buy_price) * position.shares - fee
      await db.activePositions.update(position.id!, {
        remaining_shares: 0,
        status: 'closed',
        close_reason: reason,
        close_price: currentPrice,
        close_date: today,
        pnl: totalPnl,
        pnl_pct: pnlPct,
      })
    } else {
      await db.activePositions.update(position.id!, {
        remaining_shares: newRemaining,
      })
    }

    await db.trades.add({
      portfolio_id: position.portfolio_id,
      code: position.code,
      name: position.name,
      direction: 'sell',
      shares: sellShares,
      price: currentPrice,
      fee,
      reason: reason || 'manual',
      order_id: position.order_id,
      position_id: position.id!,
      date: today,
      created_at: now,
    })
  })

  notifySellExecuted(position.name, position.code, currentPrice, sellShares, pnlPct, reason || 'manual')
}

// ===== 手动取消条件单 =====

export async function cancelOrder(orderId: number): Promise<void> {
  await db.pendingOrders.update(orderId, {
    status: 'cancelled',
    cancel_reason: 'manual',
  })
}
