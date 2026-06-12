// Worker 入口：处理 API 请求 + Cron 定时任务

import { handleApiRequest } from './api'
import { handleScheduled } from './cron'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // API 路由
    if (url.pathname.startsWith('/api/')) {
      // CORS headers
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        })
      }

      const response = await handleApiRequest(request, env)
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    // 静态资源（前端）
    return env.ASSETS.fetch(request)
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env))
  },
}
