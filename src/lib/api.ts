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
  etf_mapping: Record<string, string[]>
  orders: any[]
}) {
  return request<{ analysisId: number; createdCount: number }>('analyses', {
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
