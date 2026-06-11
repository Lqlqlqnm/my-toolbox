// 浏览器通知工具

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  new Notification(title, {
    body,
    icon: '/icon-192.png',
    tag: `trading-${Date.now()}`,
  })
}

export function notifyOrderCreated(name: string, code: string, triggerPrice: number) {
  sendNotification(
    '条件单已创建',
    `${name}(${code}) 触发价 ¥${triggerPrice.toFixed(3)}`
  )
}

export function notifyBuyExecuted(name: string, code: string, price: number, shares: number) {
  sendNotification(
    '买入成交',
    `${name}(${code}) 成交 ${shares}股 @ ¥${price.toFixed(3)}`
  )
}

export function notifySellExecuted(
  name: string,
  code: string,
  price: number,
  shares: number,
  pnlPct: number,
  reason: string
) {
  const reasonMap: Record<string, string> = {
    stop_loss: '止损',
    trailing_stop: '移动止盈',
    extreme_rally: '极端加速减仓',
    max_hold: '最大持有期',
    manual: '手动',
  }
  const pnlStr = pnlPct >= 0 ? `+${pnlPct.toFixed(1)}%` : `${pnlPct.toFixed(1)}%`
  sendNotification(
    `卖出成交 [${reasonMap[reason] || reason}]`,
    `${name}(${code}) ${shares}股 @ ¥${price.toFixed(3)} 盈亏${pnlStr}`
  )
}
