import { Link } from 'react-router-dom'
import { PieChart, Repeat, Handshake, Target, Calendar, TrendingUp, Zap, CreditCard, Download, Upload, BookOpen, Tag } from 'lucide-react'

const accountingTools = [
  { icon: <PieChart className="w-5 h-5 text-amber-500" />, label: '预算', to: '/accounting/budgets', bg: 'bg-amber-50' },
  { icon: <Repeat className="w-5 h-5 text-blue-500" />, label: '周期记账', to: '/accounting/recurring', bg: 'bg-blue-50' },
  { icon: <Handshake className="w-5 h-5 text-green-500" />, label: '借还', to: '/accounting/debts', bg: 'bg-green-50' },
  { icon: <Target className="w-5 h-5 text-red-500" />, label: '攒钱目标', to: '/accounting/savings', bg: 'bg-red-50' },
  { icon: <Calendar className="w-5 h-5 text-purple-500" />, label: '日历', to: '/accounting/list?view=calendar', bg: 'bg-purple-50' },
  { icon: <TrendingUp className="w-5 h-5 text-indigo-500" />, label: '资产趋势', to: '/accounting/trend', bg: 'bg-indigo-50' },
  { icon: <Zap className="w-5 h-5 text-cyan-500" />, label: '常用模板', to: '/accounting/templates', bg: 'bg-cyan-50' },
  { icon: <CreditCard className="w-5 h-5 text-pink-500" />, label: '信用卡', to: '/accounting/credit-cards', bg: 'bg-pink-50' },
]

const dataTools = [
  { icon: <Download className="w-5 h-5 text-teal-500" />, label: '导入', to: '/accounting/data', bg: 'bg-teal-50' },
  { icon: <Upload className="w-5 h-5 text-orange-500" />, label: '导出', to: '/accounting/data', bg: 'bg-orange-50' },
  { icon: <BookOpen className="w-5 h-5 text-gray-500" />, label: '账本', to: '/accounting/books', bg: 'bg-gray-50' },
  { icon: <Tag className="w-5 h-5 text-gray-500" />, label: '分类管理', to: '/accounting/categories', bg: 'bg-gray-50' },
]

export default function Tools() {
  return (
    <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-3">记账工具</p>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {accountingTools.map(t => (
          <Link key={t.label} to={t.to} className="flex flex-col items-center gap-1.5">
            <div className={`w-12 h-12 ${t.bg} dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm`}>{t.icon}</div>
            <span className="text-[11px] text-gray-600 dark:text-gray-300">{t.label}</span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">数据管理</p>
      <div className="grid grid-cols-4 gap-4">
        {dataTools.map(t => (
          <Link key={t.label} to={t.to} className="flex flex-col items-center gap-1.5">
            <div className={`w-12 h-12 ${t.bg} dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm`}>{t.icon}</div>
            <span className="text-[11px] text-gray-600 dark:text-gray-300">{t.label}</span>
          </Link>
        ))}
      </div>
    </main>
  )
}