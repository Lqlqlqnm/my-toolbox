import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db } from '../lib/db'

function useHomeStats() {
  const [stats, setStats] = useState({ monthExpense: 0, nextTrip: '' })

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

      setStats({ monthExpense, nextTrip })
    }
    load()
  }, [])

  return stats
}

export default function Home() {
  const { monthExpense, nextTrip } = useHomeStats()

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
      stat: '',
      statColor: 'text-green-600 dark:text-green-400',
      statLabel: '',
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

      <Link to="/settings" className="block text-center mt-8 text-sm text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
        设置
      </Link>
      <p className="text-[10px] text-gray-300 dark:text-gray-700 text-center mt-4">纯本地 · 数据不上传 · PWA</p>
    </main>
  )
}
