// 持仓监控引擎：轮询行情，检查买入触发 + 四层卖出规则

import { db } from './db'
import { fetchQuotes, type QuoteData } from './quotes'
import { executeBuy, executeSell } from './trading-engine'

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

async function checkPendingOrders(quotes: Record<string, QuoteData>): Promise<void> {
  const pendingOrders = await db.pendingOrders.where('status').equals('pending').toArray()

  for (const order of pendingOrders) {
    const quote = quotes[order.code]
    if (!quote) continue

    if (quote.price <= order.trigger_price && quote.price > 0) {
      await executeBuy(order, quote.price)
    }
  }
}

async function checkActivePositions(quotes: Record<string, QuoteData>): Promise<void> {
  const positions = await db.activePositions.where('status').equals('holding').toArray()
  const today = new Date().toISOString().split('T')[0]

  for (const position of positions) {
    const quote = quotes[position.code]
    if (!quote || quote.price <= 0) continue

    const currentPrice = quote.price
    const buyPrice = position.buy_price
    const remainingShares = position.remaining_shares

    if (currentPrice > position.highest_price) {
      await db.activePositions.update(position.id!, { highest_price: currentPrice })
      position.highest_price = currentPrice
    }

    // 规则1：固定止损
    const stopLossPrice = buyPrice * (1 - position.stop_loss_pct / 100)
    if (currentPrice <= stopLossPrice) {
      await executeSell(position, currentPrice, remainingShares, 'stop_loss')
      continue
    }

    // 规则2：移动止盈
    const highestProfitPct = ((position.highest_price - buyPrice) / buyPrice) * 100
    if (highestProfitPct >= position.activation_pct) {
      const trailingPrice = position.highest_price * (1 - position.trailing_pct / 100)
      if (currentPrice <= trailingPrice) {
        await executeSell(position, currentPrice, remainingShares, 'trailing_stop')
        continue
      }
    }

    // 规则3：极端加速（单日涨幅 > 7%，减仓50%）
    if (quote.change > 7 && remainingShares > 0) {
      const sellShares = Math.floor(remainingShares / 2 / 100) * 100
      if (sellShares >= 100) {
        await executeSell(position, currentPrice, sellShares, 'extreme_rally')
        continue
      }
    }

    // 规则4：最大持有期
    const holdDays = tradingDaysBetween(position.buy_date, today)
    if (holdDays >= position.max_hold_days) {
      await executeSell(position, currentPrice, remainingShares, 'max_hold')
      continue
    }
  }
}

export async function runMonitorCycle(): Promise<void> {
  const pendingOrders = await db.pendingOrders.where('status').equals('pending').toArray()
  const holdingPositions = await db.activePositions.where('status').equals('holding').toArray()

  const codes = new Set<string>()
  pendingOrders.forEach(o => codes.add(o.code))
  holdingPositions.forEach(p => codes.add(p.code))

  if (codes.size === 0) return

  const quotes = await fetchQuotes(Array.from(codes))
  if (Object.keys(quotes).length === 0) return

  await checkActivePositions(quotes)
  await checkPendingOrders(quotes)
}

let intervalId: ReturnType<typeof setInterval> | null = null

export function startMonitor(intervalMs = 60000): void {
  if (intervalId) return
  runMonitorCycle()
  intervalId = setInterval(runMonitorCycle, intervalMs)
}

export function stopMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function isMonitorRunning(): boolean {
  return intervalId !== null
}
