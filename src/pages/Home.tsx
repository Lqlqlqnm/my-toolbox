import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db } from '../lib/db'
import { fetchQuotes } from '../lib/quotes'

const ETF_CACHE_KEY = 'home_etf_cache'

interface EtfCache {
  totalValue: number
  changePct: number
  time: string
}

function useHomeStats() {
  const [stats, setStats] = useState({ monthExpense: 0, nextTrip: '', etfLabel: '', etfValue: '', etfColor: '' })

  useEffect(() => {
    async function load() {
      // 本月支出
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const txs = await db.transactions
        .where('date').aboveOrEqual(monthStart)
        .and(t => t.type === 'expense' && !t.is_excluded)
        .toArray()
      const monthExpense = txs.reduce((sum, t) => sum + t.amount, 0)

      // 最近旅行
      const today = now.toISOString().split('T')[0]
      const checklists = await db.travelChecklists
        .filter(c => !c.is_archived && !!c.trip_date && c.trip_date >= today)
        .sortBy('trip_date')
      const next = checklists[0]
      const nextTrip = next ? `${next.name} ${next.trip_date?.slice(5).replace('-', '/')}` : ''

      // ETF: 先用缓存，再后台刷新
      const positions = await db.activePositions.where('status').equals('holding').toArray()
      const portfolio = await db.portfolios.toCollection().first()

      let etfLabel = ''
      let etfValue = ''
      let etfColor = ''

      if (positions.length === 0 && portfolio) {
        // 无持仓，显示现金
        const cash = portfolio.cash
        etfLabel = '可用资金'
        etfValue = `¥${(cash / 10000).toFixed(1)}万`
        etfColor = 'text-gray-700 dark:text-gray-300'
      } else if (positions.length > 0) {
        // 有持仓：先显示缓存
        const cached = localStorage.getItem(ETF_CACHE_KEY)
        if (cached) {
          const c: EtfCache = JSON.parse(cached)
          etfLabel = `持仓 ${positions.length} 只`
          etfValue = `${c.changePct >= 0 ? '+' : ''}${c.changePct.toFixed(2)}%`
          etfColor = c.changePct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
        } else {
          // 无缓存，用兜底
          etfLabel = ''
          etfValue = `持仓 ${positions.length} 只`
          etfColor = 'text-gray-600 dark:text-gray-400'
        }

        // 后台静默刷新行情
        const codes = [...new Set(positions.map(p => p.code))]
        fetchQuotes(codes).then(quotes => {
          let totalCost = 0
          let totalMarketValue = 0
          for (const pos of positions) {
            const q = quotes[pos.code]
            const price = q?.price || pos.buy_price
            totalCost += pos.buy_price * pos.remaining_shares
            totalMarketValue += price * pos.remaining_shares
          }
          const changePct = totalCost > 0 ? ((totalMarketValue - totalCost) / totalCost) * 100 : 0

          // 更新缓存
          const cache: EtfCache = { totalValue: totalMarketValue, changePct, time: new Date().toISOString() }
          localStorage.setItem(ETF_CACHE_KEY, JSON.stringify(cache))

          // 更新显示
          setStats(prev => ({
            ...prev,
            etfLabel: `持仓 ${positions.length} 只`,
            etfValue: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
            etfColor: changePct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400',
          }))
        })
      }

      setStats({ monthExpense, nextTrip, etfLabel, etfValue, etfColor })
    }
    load()
  }, [])

  return stats
}

export default function Home() {
  const { monthExpense, nextTrip, etfLabel, etfValue, etfColor } = useHomeStats()

  const tools = [
    {
      name: 'ETF 策略助手',
      desc: '文章分析 · 模拟仓 · 条件单',
      href: '/trading',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" />
        </svg>
      ),
      darkGradient: 'from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
      lightBorder: 'from-blue-500 to-purple-500',
      glowColor: 'bg-blue-500/10 dark:bg-blue-500/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      stat: etfValue,
      statColor: etfColor || 'text-green-600 dark:text-green-400',
      statLabel: etfLabel,
    },
    {
      name: '记账本',
      desc: '收支记录 · 多账户 · 统计',
      href: '/accounting',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
      darkGradient: 'from-[#2d1b00] via-[#3d2200] to-[#4a2c00]',
      lightBorder: 'from-amber-500 to-red-500',
      glowColor: 'bg-amber-500/10 dark:bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      stat: monthExpense > 0 ? `¥${monthExpense.toLocaleString()}` : '',
      statColor: 'text-gray-700 dark:text-amber-300',
      statLabel: monthExpense > 0 ? '本月支出' : '',
    },
    {
      name: '旅行清单',
      desc: '自定义模板 · 出行打勾',
      href: '/travel',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 16v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" /><path d="M3 10l3-6h12l3 6" />
        </svg>
      ),
      darkGradient: 'from-[#002e1a] via-[#003d23] to-[#004d2d]',
      lightBorder: 'from-emerald-500 to-cyan-500',
      glowColor: 'bg-emerald-500/10 dark:bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      stat: nextTrip || '',
      statColor: 'text-emerald-600 dark:text-emerald-300',
      statLabel: nextTrip ? '下一趟' : '',
    },
  ]

  return (
    <main className="max-w-lg mx-auto px-5 py-8">
      <div className="text-center mb-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">My Toolbox</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">个人工具箱</p>
      </div>

      <div className="space-y-5">
        {tools.map(tool => (
          <Link key={tool.href} to={tool.href} className="block">
            {/* Dark: colored gradient card */}
            <div className="hidden dark:block rounded-2xl p-5 relative overflow-hidden group cursor-pointer">
              <div className={`absolute inset-0 bg-gradient-to-br ${tool.darkGradient}`}></div>
              <div className={`absolute top-0 right-0 w-24 h-24 ${tool.glowColor} rounded-full blur-2xl`}></div>
              <div className="relative flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center ${tool.iconColor}`}>
                  {tool.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-white">{tool.name}</h2>
                  <p className="text-[11px] text-white/40">{tool.desc}</p>
                </div>
                {tool.stat && (
                  <div className="text-right">
                    <p className="text-[10px] text-white/30">{tool.statLabel}</p>
                    <p className={`text-sm font-bold ${tool.statColor}`}>{tool.stat}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Light: white card + left gradient border + glow */}
            <div className="dark:hidden rounded-2xl p-5 bg-white border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer">
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b ${tool.lightBorder}`}></div>
              <div className={`absolute bottom-0 right-4 w-24 h-12 ${tool.glowColor} rounded-full blur-2xl opacity-50`}></div>
              <div className="relative flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center ${tool.iconColor}`}>
                  {tool.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-gray-900">{tool.name}</h2>
                  <p className="text-[11px] text-gray-400">{tool.desc}</p>
                </div>
                {tool.stat && (
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">{tool.statLabel}</p>
                    <p className={`text-sm font-bold ${tool.statColor}`}>{tool.stat}</p>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* More tools grid */}
      <div className="mt-6">
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-3 px-1">更多工具</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { name: '相关性', href: '/correlation', icon: '🔬' },
            { name: '订阅', href: '/subscriptions', icon: '🔄' },
            { name: '储物', href: '/storage', icon: '📦' },
            { name: '食材', href: '/food', icon: '🥬' },
            { name: '身体', href: '/body', icon: '📐' },
            { name: '习惯', href: '/habits', icon: '✅' },
            { name: '年报', href: '/annual', icon: '📊' },
            { name: '密码本', href: '/vault', icon: '🔐' },
          ].map(t => (
            <Link key={t.href} to={t.href} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.04]">
              <span className="text-xl">{t.icon}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{t.name}</span>
            </Link>
          ))}
        </div>
      </div>

      <Link to="/settings" className="block text-center mt-8 text-sm text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
        设置
      </Link>
      <p className="text-[10px] text-gray-300 dark:text-gray-700 text-center mt-4">纯本地 · 数据不上传 · PWA</p>
    </main>
  )
}
