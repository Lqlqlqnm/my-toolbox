// API 路由处理

import type { Env } from './index'

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/', '')
  const method = request.method

  try {
    // GET routes
    if (method === 'GET') {
      if (path === 'portfolio') return getPortfolio(env)
      if (path === 'orders') return getOrders(env, url)
      if (path === 'positions') return getPositions(env, url)
      if (path === 'analyses') return getAnalyses(env)
      if (path === 'watchlist') return getWatchlist(env)
      if (path === 'stats') return getStats(env)
      if (path === 'notifications') return getNotifications(env, url)
    }

    // POST routes
    if (method === 'POST') {
      if (path === 'analyses') return postAnalysis(request, env)
      if (path.startsWith('orders/cancel/')) return cancelOrder(path, env)
      if (path === 'watchlist') return addWatchlist(request, env)
      if (path === 'images/upload') return uploadImage(request, env)
      if (path === 'fetch-url') return fetchUrl(request, env)
    }

    // DELETE routes
    if (method === 'DELETE') {
      if (path.startsWith('watchlist/')) return deleteWatchlist(path, env)
    }

    // GET images
    if (method === 'GET' && path.startsWith('images/')) {
      return getImage(path, env)
    }

    return json({ error: 'Not found' }, 404)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500)
  }
}

// ===== GET handlers =====

async function getPortfolio(env: Env): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM portfolios LIMIT 1').first()
  return json(row || null)
}

async function getOrders(env: Env, url: URL): Promise<Response> {
  const status = url.searchParams.get('status')
  let query = 'SELECT * FROM pending_orders'
  if (status && status !== 'all') query += ` WHERE status = '${status}'`
  query += ' ORDER BY created_at DESC LIMIT 100'
  const { results } = await env.DB.prepare(query).all()
  return json(results)
}

async function getPositions(env: Env, url: URL): Promise<Response> {
  const status = url.searchParams.get('status') || 'holding'
  const { results } = await env.DB.prepare(
    'SELECT * FROM active_positions WHERE status = ? ORDER BY buy_date DESC LIMIT 100'
  ).bind(status).all()
  return json(results)
}

async function getAnalyses(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM analyses ORDER BY created_at DESC LIMIT 20'
  ).all()
  return json(results)
}

async function getWatchlist(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT * FROM watchlist ORDER BY added_at DESC').all()
  return json(results)
}

async function getStats(env: Env): Promise<Response> {
  const { results: closed } = await env.DB.prepare(
    'SELECT * FROM active_positions WHERE status = ?'
  ).bind('closed').all()

  if (!closed || closed.length === 0) return json(null)

  const wins = closed.filter((p: any) => (p.pnl_pct || 0) > 0)
  const totalPnl = closed.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0)
  const avgPnlPct = closed.reduce((sum: number, p: any) => sum + (p.pnl_pct || 0), 0) / closed.length

  const avgHoldDays = closed.reduce((sum: number, p: any) => {
    if (!p.close_date) return sum
    const days = Math.ceil((new Date(p.close_date).getTime() - new Date(p.buy_date).getTime()) / 86400000)
    return sum + days
  }, 0) / closed.length

  const pnlPcts = closed.map((p: any) => p.pnl_pct || 0)

  const reasonBreakdown: Record<string, { count: number; avgPnl: number }> = {}
  for (const p of closed as any[]) {
    const reason = p.close_reason || 'unknown'
    if (!reasonBreakdown[reason]) reasonBreakdown[reason] = { count: 0, avgPnl: 0 }
    reasonBreakdown[reason].count++
    reasonBreakdown[reason].avgPnl += p.pnl_pct || 0
  }
  for (const key of Object.keys(reasonBreakdown)) {
    reasonBreakdown[key].avgPnl /= reasonBreakdown[key].count
  }

  return json({
    totalTrades: closed.length,
    winCount: wins.length,
    lossCount: closed.length - wins.length,
    winRate: (wins.length / closed.length) * 100,
    totalPnl,
    avgPnlPct,
    avgHoldDays,
    maxWin: Math.max(...pnlPcts),
    maxLoss: Math.min(...pnlPcts),
    reasonBreakdown,
  })
}

async function getNotifications(env: Env, url: URL): Promise<Response> {
  const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'
  const { results } = await env.DB.prepare(
    'SELECT * FROM notifications WHERE created_at > ? ORDER BY created_at DESC LIMIT 50'
  ).bind(since).all()
  return json(results)
}

// ===== POST handlers =====

async function postAnalysis(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any

  // 保存分析记录
  const { meta } = await env.DB.prepare(
    `INSERT INTO analyses (articles, market_view, main_sectors, core_logic, etf_mapping, orders, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    JSON.stringify(body.articles),
    body.market_view,
    JSON.stringify(body.main_sectors),
    body.core_logic,
    JSON.stringify(body.etf_mapping),
    JSON.stringify(body.orders),
    new Date().toISOString()
  ).run()

  const analysisId = meta.last_row_id

  // 获取模拟仓 ID
  const portfolio = await env.DB.prepare('SELECT id FROM portfolios LIMIT 1').first<{ id: number }>()
  if (!portfolio) return json({ error: 'No portfolio' }, 400)

  // 自动创建条件单
  let createdCount = 0
  for (const order of body.orders || []) {
    if (order.direction !== 'buy') continue

    // 检查已有持仓
    const existing = await env.DB.prepare(
      'SELECT id FROM active_positions WHERE portfolio_id = ? AND code = ? AND status = ?'
    ).bind(portfolio.id, order.code, 'holding').first()
    if (existing) continue

    // 取消旧的 pending 单
    await env.DB.prepare(
      `UPDATE pending_orders SET status = 'cancelled', cancel_reason = 'superseded'
       WHERE portfolio_id = ? AND code = ? AND status = 'pending'`
    ).bind(portfolio.id, order.code).run()

    // 创建新条件单
    await env.DB.prepare(
      `INSERT INTO pending_orders (portfolio_id, analysis_id, code, name, direction, trigger_price, position_pct,
       stop_loss_pct, trailing_pct, activation_pct, max_hold_days, reason, status, cancel_reason,
       executed_price, executed_shares, executed_at, created_at)
       VALUES (?, ?, ?, ?, 'buy', ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, ?)`
    ).bind(
      portfolio.id, analysisId, order.code, order.name, order.trigger_price, order.position_pct,
      order.stop_loss_pct, order.trailing_pct, order.activation_pct, order.max_hold_days,
      order.reason, new Date().toISOString()
    ).run()

    // 写入通知
    await env.DB.prepare(
      `INSERT INTO notifications (type, title, body, created_at)
       VALUES ('order_created', '条件单已创建', ?, ?)`
    ).bind(
      `${order.name}(${order.code}) 触发价 ¥${order.trigger_price.toFixed(3)}`,
      new Date().toISOString()
    ).run()

    createdCount++
  }

  return json({ analysisId, createdCount })
}

async function cancelOrder(path: string, env: Env): Promise<Response> {
  const id = path.replace('orders/cancel/', '')
  await env.DB.prepare(
    `UPDATE pending_orders SET status = 'cancelled', cancel_reason = 'manual' WHERE id = ?`
  ).bind(id).run()
  return json({ ok: true })
}

async function addWatchlist(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  await env.DB.prepare(
    'INSERT INTO watchlist (code, name, reason, added_at) VALUES (?, ?, ?, ?)'
  ).bind(body.code, body.name || body.code, body.reason || '', new Date().toISOString()).run()
  return json({ ok: true })
}

async function deleteWatchlist(path: string, env: Env): Promise<Response> {
  const id = path.replace('watchlist/', '')
  await env.DB.prepare('DELETE FROM watchlist WHERE id = ?').bind(id).run()
  return json({ ok: true })
}

// ===== Helpers =====

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ===== Image Upload =====

async function uploadImage(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return json({ error: 'No file provided' }, 400)

    const buffer = await file.arrayBuffer()
    if (buffer.byteLength > 2 * 1024 * 1024) return json({ error: 'File too large (max 2MB)' }, 400)

    const { meta } = await env.DB.prepare(
      'INSERT INTO analysis_images (filename, mime_type, data, created_at) VALUES (?, ?, ?, ?)'
    ).bind(file.name, file.type, buffer, new Date().toISOString()).run()

    return json({ id: meta.last_row_id, filename: file.name })
  }

  // JSON body with base64
  const body = await request.json() as any
  if (!body.data || !body.mime_type) return json({ error: 'Missing data or mime_type' }, 400)

  const binaryStr = atob(body.data)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

  if (bytes.byteLength > 2 * 1024 * 1024) return json({ error: 'File too large (max 2MB)' }, 400)

  const { meta } = await env.DB.prepare(
    'INSERT INTO analysis_images (filename, mime_type, data, created_at) VALUES (?, ?, ?, ?)'
  ).bind(body.filename || 'image', body.mime_type, bytes.buffer, new Date().toISOString()).run()

  return json({ id: meta.last_row_id, filename: body.filename || 'image' })
}

// ===== Get Image =====

async function getImage(path: string, env: Env): Promise<Response> {
  const id = path.replace('images/', '')
  const row = await env.DB.prepare(
    'SELECT mime_type, data FROM analysis_images WHERE id = ?'
  ).bind(id).first<{ mime_type: string; data: ArrayBuffer }>()

  if (!row) return new Response('Not found', { status: 404 })

  return new Response(row.data, {
    headers: { 'Content-Type': row.mime_type, 'Cache-Control': 'public, max-age=86400' },
  })
}

// ===== URL Fetch (extract article text) =====

async function fetchUrl(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  const url = body.url as string
  if (!url) return json({ error: 'Missing url' }, 400)

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })

    if (!resp.ok) return json({ error: `Fetch failed: ${resp.status}` }, 400)

    const html = await resp.text()
    const text = extractTextFromHtml(html)

    if (!text || text.length < 50) {
      return json({ error: '无法提取文章内容，请手动复制粘贴' }, 400)
    }

    return json({ text, length: text.length })
  } catch (e) {
    return json({ error: `抓取失败: ${e instanceof Error ? e.message : 'Unknown'}` }, 400)
  }
}

// Simple HTML to text extraction (runs in Worker, no DOM)
function extractTextFromHtml(html: string): string {
  // Remove script, style, nav, header, footer
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')

  // Try to extract article/main content
  const articleMatch = text.match(/<article[\s\S]*?<\/article>/i)
    || text.match(/<div[^>]*class="[^"]*content[^"]*"[\s\S]*?<\/div>/i)
    || text.match(/<div[^>]*id="[^"]*content[^"]*"[\s\S]*?<\/div>/i)
    || text.match(/<main[\s\S]*?<\/main>/i)

  if (articleMatch) text = articleMatch[0]

  // Strip all tags
  text = text.replace(/<[^>]+>/g, '\n')
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim()

  return text.substring(0, 8000)
}

// ===== Cleanup expired images (called from cron) =====

export async function cleanupExpiredImages(env: Env): Promise<number> {
  const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  const { meta } = await env.DB.prepare(
    'DELETE FROM analysis_images WHERE created_at < ?'
  ).bind(cutoff).run()
  return meta.changes || 0
}
