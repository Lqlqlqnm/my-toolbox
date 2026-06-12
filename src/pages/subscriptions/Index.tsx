import { useState } from 'react'
import { Link, Routes, Route } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Subscription } from '../../lib/db'
import { Plus, ChevronLeft } from 'lucide-react'
import AddEdit from './AddEdit'

const CATEGORIES = ['全部', '视频', '音乐', '工具', '云服务', '其他'] as const
const OWNERS = ['全部', '我', '爱人', '共用'] as const

function calcMonthlyAmount(sub: Subscription): number {
  if (sub.cycle === 'monthly') return sub.amount
  if (sub.cycle === 'yearly') return sub.amount / 12
  if (sub.cycle === 'weekly') return sub.amount * 4.33
  return sub.amount
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function SubscriptionList() {
  const [catFilter, setCatFilter] = useState('全部')
  const [ownerFilter, setOwnerFilter] = useState('全部')

  const allSubs = useLiveQuery(() => db.subscriptions.orderBy('next_billing_date').toArray())

  if (!allSubs) return null

  const filtered = allSubs.filter(s => {
    if (catFilter !== '全部' && s.category !== catFilter) return false
    if (ownerFilter !== '全部' && s.owner !== ownerFilter) return false
    return true
  })

  const activeSubs = allSubs.filter(s => s.is_active)
  const monthlyTotal = activeSubs.reduce((sum, s) => sum + calcMonthlyAmount(s), 0)
  const yearlyTotal = monthlyTotal * 12

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">订阅管理</h1>
          <Link to="/subscriptions/add" className="text-gray-600 dark:text-gray-300"><Plus size={20} /></Link>
        </div>
      </div>

      <div className="p-4">
        {/* Summary */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-gray-800 dark:text-white">¥{Math.round(monthlyTotal)}</p>
            <p className="text-[10px] text-gray-400">月均支出</p>
          </div>
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-gray-800 dark:text-white">¥{Math.round(yearlyTotal).toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">年度总计</p>
          </div>
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-gray-800 dark:text-white">{activeSubs.length}</p>
            <p className="text-[10px] text-gray-400">活跃订阅</p>
          </div>
        </div>

        {/* Owner filter */}
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {OWNERS.map(o => (
            <button
              key={o}
              onClick={() => setOwnerFilter(o)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                ownerFilter === o ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-[#141416] text-gray-500 border border-gray-200 dark:border-white/[0.06]'
              }`}
            >
              {o}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                catFilter === c ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-[#141416] text-gray-500 border border-gray-200 dark:border-white/[0.06]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.map(sub => {
            const days = daysUntil(sub.next_billing_date)
            return (
              <Link
                key={sub.id}
                to={`/subscriptions/edit/${sub.id}`}
                className={`block bg-white dark:bg-[#141416] rounded-xl p-3.5 ${!sub.is_active ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: sub.color + '20' }}>
                    {sub.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {sub.name}
                      {!sub.is_active && <span className="text-[10px] text-gray-400 ml-1">(已暂停)</span>}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {sub.category} · {sub.owner} · {sub.platform || '未设置'}
                      {sub.is_active && days <= 1 && <span className="ml-1 text-red-500 font-medium">{days <= 0 ? '今天续费' : '明天续费'}</span>}
                      {sub.is_active && days > 1 && days <= 3 && <span className="ml-1 text-amber-500 font-medium">{days}天后续费</span>}
                      {sub.is_active && days > 3 && <span className="ml-1">{sub.next_billing_date.slice(5).replace('-', '月') + '日'}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {sub.currency === 'USD' ? '$' : '¥'}{sub.amount}
                    </p>
                    <p className="text-[10px] text-gray-400">/{sub.cycle === 'monthly' ? '月' : sub.cycle === 'yearly' ? '年' : '周'}</p>
                  </div>
                </div>
              </Link>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">暂无订阅</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionsIndex() {
  return (
    <Routes>
      <Route path="/" element={<SubscriptionList />} />
      <Route path="/add" element={<AddEdit />} />
      <Route path="/edit/:id" element={<AddEdit />} />
    </Routes>
  )
}
