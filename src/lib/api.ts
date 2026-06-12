// 前端 API 层：调用 Worker API 替代本地 IndexedDB

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((err as any).error || `HTTP ${resp.status}`)
  }
  return resp.json()
}

// ===== Portfolio =====

export async function getPortfolio() {
  return request<any>('portfolio')
}

// ===== Orders =====

export async function getOrders(status: string = 'all') {
  return request<any[]>(`orders?status=${status}`)
}

export async function cancelOrder(id: number) {
  return request<any>(`orders/cancel/${id}`, { method: 'POST' })
}

// ===== Positions =====

export async function getPositions(status: string = 'holding') {
  return request<any[]>(`positions?status=${status}`)
}

// ===== Analyses =====

export async function getAnalyses() {
  return request<any[]>('analyses')
}

export async function submitAnalysis(data: {
  articles: string[]
  market_view: string
  main_sectors: string[]
  core_logic: string
  etf_recommendations: any[]
}) {
  return request<{ analysisId: number; createdCount: number; orders: any[] }>('analyses', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ===== Watchlist =====

export async function getWatchlist() {
  return request<any[]>('watchlist')
}

export async function addWatchlistItem(code: string, name: string, reason: string) {
  return request<any>('watchlist', {
    method: 'POST',
    body: JSON.stringify({ code, name, reason }),
  })
}

export async function deleteWatchlistItem(id: number) {
  return request<any>(`watchlist/${id}`, { method: 'DELETE' })
}

// ===== Stats =====

export async function getStats() {
  return request<any>('stats')
}

// ===== Notifications =====

export async function getNotifications(since: string) {
  return request<any[]>(`notifications?since=${encodeURIComponent(since)}`)
}

// ===== Images =====

export async function uploadImage(file: File): Promise<{ id: number; filename: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await fetch(`${BASE}/images/upload`, { method: 'POST', body: formData })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error((err as any).error || `HTTP ${resp.status}`)
  }
  return resp.json()
}

export function getImageUrl(id: number): string {
  return `${BASE}/images/${id}`
}

// ===== URL Fetch =====

export async function fetchArticleUrl(url: string): Promise<{ text: string; length: number }> {
  return request<{ text: string; length: number }>('fetch-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

// ===== Web Push =====

export async function getVapidPublicKey(): Promise<string> {
  const data = await request<{ publicKey: string }>('push/vapid-key')
  return data.publicKey
}

export async function subscribePush(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  await request('push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  })
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await request('push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  })
}
