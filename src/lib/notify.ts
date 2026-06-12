// 推送通知管理：注册 Service Worker + 订阅 Web Push

import { getVapidPublicKey, subscribePush, unsubscribePush } from './api'

// ===== 注册推送 =====

export async function registerPush(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }

  // 请求通知权限
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  try {
    // 注册 push service worker
    const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    // 获取 VAPID public key
    const vapidKey = await getVapidPublicKey()
    const applicationServerKey = urlBase64ToUint8Array(vapidKey)

    // 订阅推送
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })
    }

    // 发送订阅信息到服务器
    await subscribePush(subscription)
    localStorage.setItem('push_registered', 'true')
    return 'granted'
  } catch (e) {
    console.error('Push registration failed:', e)
    return 'unsupported'
  }
}

// ===== 取消推送 =====

export async function unregisterPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
    if (!registration) return

    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await unsubscribePush(subscription.endpoint)
      await subscription.unsubscribe()
    }

    localStorage.removeItem('push_registered')
  } catch (e) {
    console.error('Push unregister failed:', e)
  }
}

// ===== 检查推送状态 =====

export function isPushRegistered(): boolean {
  return localStorage.getItem('push_registered') === 'true'
}

export async function getPushStatus(): Promise<'active' | 'inactive' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }

  // Check if VAPID key is configured on server
  try {
    const { publicKey } = await (await fetch('/api/push/vapid-key')).json() as any
    if (!publicKey) return 'unsupported'
  } catch {
    return 'unsupported'
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
    if (!registration) return 'inactive'

    const subscription = await registration.pushManager.getSubscription()
    return subscription ? 'active' : 'inactive'
  } catch {
    return 'unsupported'
  }
}

// ===== 本地通知兜底（App 打开时用） =====

export function sendLocalNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  new Notification(title, {
    body,
    icon: '/icon-192.png',
    tag: `local-${Date.now()}`,
  })
}

// ===== 工具函数 =====

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ===== 兼容旧接口 =====

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendNotification(title: string, body: string) {
  sendLocalNotification(title, body)
}

export function notifyOrderCreated(name: string, code: string, triggerPrice: number) {
  sendLocalNotification('条件单已创建', `${name}(${code}) 触发价 ¥${triggerPrice.toFixed(3)}`)
}

export function notifyBuyExecuted(name: string, code: string, price: number, shares: number) {
  sendLocalNotification('买入成交', `${name}(${code}) 成交 ${shares}股 @ ¥${price.toFixed(3)}`)
}

export function notifySellExecuted(name: string, code: string, price: number, shares: number, pnlPct: number, reason: string) {
  const reasonMap: Record<string, string> = { stop_loss: '止损', trailing_stop: '移动止盈', extreme_rally: '极端加速减仓', max_hold: '最大持有期', manual: '手动' }
  const pnlStr = pnlPct >= 0 ? `+${pnlPct.toFixed(1)}%` : `${pnlPct.toFixed(1)}%`
  sendLocalNotification(`卖出成交 [${reasonMap[reason] || reason}]`, `${name}(${code}) ${shares}股 @ ¥${price.toFixed(3)} 盈亏${pnlStr}`)
}
