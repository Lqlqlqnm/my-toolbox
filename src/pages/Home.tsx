import { Link } from 'react-router-dom'

const tools = [
  { name: 'ETF 策略助手', desc: '文章分析 · 模拟仓 · 条件单', href: '/trading', icon: '📈', color: 'from-blue-500 to-indigo-600' },
  { name: '记账本', desc: '收支记录 · 多账户 · 统计', href: '/accounting', icon: '💰', color: 'from-amber-500 to-orange-600' },
  { name: '旅行清单', desc: '自定义模板 · 出行打勾', href: '/travel', icon: '✈️', color: 'from-emerald-500 to-teal-600' },
]

export default function Home() {
  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-center mb-2 text-gray-800 dark:text-gray-100">My Toolbox</h1>
      <p className="text-sm text-gray-400 text-center mb-8">个人工具箱</p>

      <div className="space-y-4">
        {tools.map(tool => (
          <Link key={tool.href} to={tool.href}>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tool.color} flex items-center justify-center text-2xl`}>
                {tool.icon}
              </div>
              <div>
                <h2 className="font-medium text-gray-800 dark:text-gray-100">{tool.name}</h2>
                <p className="text-xs text-gray-400">{tool.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Link to="/settings" className="block text-center mt-8 text-sm text-gray-400 hover:text-amber-500">设置</Link>
      <p className="text-xs text-gray-300 dark:text-gray-600 text-center mt-4">纯本地 · 数据不上传 · PWA</p>
    </main>
  )
}
