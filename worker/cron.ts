// Cron 定时任务：每分钟轮询行情，执行交易逻辑

import type { Env } from './index'
import { cleanupExpiredImages } from './api'
import { sendPushToAll } from './push'

const FEE_RATE = 0.0001

// 东方财富 HTTP API（Worker 端无 CORS 限制）
async function fetchQuote(code: string): Promise<{ price: number; change: number; name: string } | null> {
  const secid = code.startsWith('5') || code.startsWith('6') ? `1.${code}` : `0.${code}`
  try {
    const resp = await fetch(
      `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f57,f58,f169,f170&cb=`,
      { headers: { 'Referer': 'https://quote.eastmoney.com/' } }
    )
    const text = await resp.text()
    // 返回格式可能是 JSONP 或纯 JSON
    const jsonStr = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '') || text
    const data = JSON.parse(jsonStr)
    if (!data?.data) return null
    const d = data.data
    return {
      price: Number(d.f43) / 1000,
      change: Number(d.f170) / 100,
      name: String(d.f58 || ''),
    }
  } catch {
    return null
  }
}

async function fetchQuotes(codes: string[]): Promise<Record<string, { price: number; change: number; name: string }>> {
  const results: Record<string, { price: number; change: number; name: string }> = {}
  await Promise.all(
    codes.map(async (code) => {
      const q = await fetchQuote(code)
      if (q && q.price > 0) results[code] = q
    })
  )
  return results
}

// 计算交易日
function tradingDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

// 判断是否在交易时间（避免非交易时段浪费调用）
function isTradingTime(): boolean {
  const now = new Date()
  // UTC+8
  const hour = (now.getUTCHours() + 8) % 24
  const minute = now.getUTCMinutes()
  const day = now.getUTCDay()
  // 周末不执行
  if (day === 0 || day === 6) return false
  // 交易时间 9:15-11:35, 12:55-15:05（稍微放宽）
  const time = hour * 60 + minute
  if (time >= 555 && time <= 695) return true  // 9:15 - 11:35
  if (time >= 775 && time <= 905) return true  // 12:55 - 15:05
  return false
}

// ===== 买入执行 =====
async function executeBuy(env: Env, order: any, currentPrice: number): Promise<void> {
  const portfolio = await env.DB.prepare('SELECT * FROM portfolios WHERE id = ?').bind(order.portfolio_id).first<any>()
  if (!portfolio) return

  const amount = portfolio.cash * (order.position_pct / 100)
  const shares = Math.floor(amount / currentPrice / 100) * 100
  if (shares <= 0) return

  const cost = shares * currentPrice
  const fee = Math.max(cost * FEE_RATE, 0.1)
  const totalCost = cost + fee
  if (totalCost > portfolio.cash) return

  const now = new Date().toISOString()
  const today = now.split('T')[0]

  // 扣减 cash
  await env.DB.prepare('UPDATE portfolios SET cash = cash - ? WHERE id = ?')
    .bind(totalCost, order.portfolio_id).run()

  // 更新条件单
  await env.DB.prepare(
    `UPDATE pending_orders SET status = 'executed', executed_price = ?, executed_shares = ?, executed_at = ? WHERE id = ?`
  ).bind(currentPrice, shares, now, order.id).run()

  // 创建持仓
  const { meta } = await env.DB.prepare(
    `INSERT INTO active_positions (portfolio_id, order_id, analysis_id, code, name, buy_price, shares, remaining_shares,
     highest_price, buy_date, stop_loss_pct, trailing_pct, activation_pct, max_hold_days, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'holding')`
  ).bind(
    order.portfolio_id, order.id, order.analysis_id, order.code, order.name,
    currentPrice, shares, shares, currentPrice, today,
    order.stop_loss_pct, order.trailing_pct, order.activation_pct, order.max_hold_days
  ).run()

  // 交易记录
  await env.DB.prepare(
    `INSERT INTO trades (portfolio_id, code, name, direction, shares, price, fee, reason, order_id, position_id, date, created_at)
     VALUES (?, ?, ?, 'buy', ?, ?, ?, 'signal', ?, ?, ?, ?)`
  ).bind(order.portfolio_id, order.code, order.name, shares, currentPrice, fee, order.id, meta.last_row_id, today, now).run()

  // 通知
  const notifyBody = `${order.name}(${order.code}) ${shares}股 @ ¥${currentPrice.toFixed(3)}`
  await env.DB.prepare(
    `INSERT INTO notifications (type, title, body, created_at) VALUES ('buy_executed', '买入成交', ?, ?)`
  ).bind(notifyBody, now).run()

  // Web Push
  await sendPushToAll(env, '买入成交', notifyBody, 'buy')
}

// ===== 卖出执行 =====
async function executeSell(env: Env, position: any, currentPrice: number, sellShares: number, reason: string): Promise<void> {
  const portfolio = await env.DB.prepare('SELECT * FROM portfolios WHERE id = ?').bind(position.portfolio_id).first<any>()
  if (!portfolio) return

  const revenue = sellShares * currentPrice
  const fee = Math.max(revenue * FEE_RATE, 0.1)
  const netRevenue = revenue - fee

  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const newRemaining = position.remaining_shares - sellShares
  const isFull = newRemaining <= 0
  const pnlPct = ((currentPrice - position.buy_price) / position.buy_price) * 100

  // 增加 cash
  await env.DB.prepare('UPDATE portfolios SET cash = cash + ? WHERE id = ?')
    .bind(netRevenue, position.portfolio_id).run()

  // 更新持仓
  if (isFull) {
    const totalPnl = (currentPrice - position.buy_price) * position.shares - fee
    await env.DB.prepare(
      `UPDATE active_positions SET remaining_shares = 0, status = 'closed', close_reason = ?, close_price = ?, close_date = ?, pnl = ?, pnl_pct = ? WHERE id = ?`
    ).bind(reason, currentPrice, today, totalPnl, pnlPct, position.id).run()
  } else {
    await env.DB.prepare('UPDATE active_positions SET remaining_shares = ? WHERE id = ?')
      .bind(newRemaining, position.id).run()
  }

  // 交易记录
  await env.DB.prepare(
    `INSERT INTO trades (portfolio_id, code, name, direction, shares, price, fee, reason, order_id, position_id, date, created_at)
     VALUES (?, ?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(position.portfolio_id, position.code, position.name, sellShares, currentPrice, fee, reason, position.order_id, position.id, today, now).run()

  // 通知
  const pnlStr = pnlPct >= 0 ? `+${pnlPct.toFixed(1)}%` : `${pnlPct.toFixed(1)}%`
  const reasonMap: Record<string, string> = { stop_loss: '止损', trailing_stop: '移动止盈', extreme_rally: '极端加速', max_hold: '到期', manual: '手动' }
  const sellTitle = `卖出[${reasonMap[reason] || reason}]`
  const sellBody = `${position.name}(${position.code}) ${sellShares}股 @ ¥${currentPrice.toFixed(3)} 盈亏${pnlStr}`
  await env.DB.prepare(
    `INSERT INTO notifications (type, title, body, created_at) VALUES ('sell_executed', ?, ?, ?)`
  ).bind(sellTitle, sellBody, now).run()

  // Web Push
  await sendPushToAll(env, sellTitle, sellBody, 'sell')
}

// ===== 主逻辑 =====
export async function handleScheduled(env: Env): Promise<void> {
  // 每小时第0分钟清理过期图片
  const now = new Date()
  const minute = now.getUTCMinutes()
  if (minute === 0) {
    await cleanupExpiredImages(env)
  }

  // 非交易时间不执行
  if (!isTradingTime()) return

  // 收集需要查询的代码
  const { results: pendingOrders } = await env.DB.prepare(
    `SELECT * FROM pending_orders WHERE status = 'pending'`
  ).all<any>()

  const { results: holdingPositions } = await env.DB.prepare(
    `SELECT * FROM active_positions WHERE status = 'holding'`
  ).all<any>()

  const codes = new Set<string>()
  pendingOrders?.forEach((o: any) => codes.add(o.code))
  holdingPositions?.forEach((p: any) => codes.add(p.code))

  if (codes.size === 0) return

  // 批量获取行情
  const quotes = await fetchQuotes(Array.from(codes))
  if (Object.keys(quotes).length === 0) return

  const today = new Date().toISOString().split('T')[0]

  // 先检查卖出
  for (const position of holdingPositions || []) {
    const quote = quotes[position.code]
    if (!quote) continue

    const currentPrice = quote.price
    const buyPrice = position.buy_price
    const remainingShares = position.remaining_shares

    // 更新最高价
    if (currentPrice > position.highest_price) {
      await env.DB.prepare('UPDATE active_positions SET highest_price = ? WHERE id = ?')
        .bind(currentPrice, position.id).run()
      position.highest_price = currentPrice
    }

    // 规则1：固定止损
    if (currentPrice <= buyPrice * (1 - position.stop_loss_pct / 100)) {
      await executeSell(env, position, currentPrice, remainingShares, 'stop_loss')
      continue
    }

    // 规则2：移动止盈
    const highestProfitPct = ((position.highest_price - buyPrice) / buyPrice) * 100
    if (highestProfitPct >= position.activation_pct) {
      const trailingPrice = position.highest_price * (1 - position.trailing_pct / 100)
      if (currentPrice <= trailingPrice) {
        await executeSell(env, position, currentPrice, remainingShares, 'trailing_stop')
        continue
      }
    }

    // 规则3：极端加速
    if (quote.change > 7 && remainingShares > 0) {
      const sellShares = Math.floor(remainingShares / 2 / 100) * 100
      if (sellShares >= 100) {
        await executeSell(env, position, currentPrice, sellShares, 'extreme_rally')
        continue
      }
    }

    // 规则4：最大持有期
    const holdDays = tradingDaysBetween(position.buy_date, today)
    if (holdDays >= position.max_hold_days) {
      await executeSell(env, position, currentPrice, remainingShares, 'max_hold')
      continue
    }
  }

  // 再检查买入
  for (const order of pendingOrders || []) {
    const quote = quotes[order.code]
    if (!quote) continue

    if (quote.price <= order.trigger_price) {
      await executeBuy(env, order, quote.price)
    }
  }
}
