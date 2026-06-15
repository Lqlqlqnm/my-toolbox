import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { ChevronLeft } from 'lucide-react'

interface ReportData {
  // 记账
  totalExpense: number
  totalIncome: number
  savings: number
  savingsRate: number
  monthlyAvg: number
  dailyAvg: number
  maxExpense: { amount: number; note: string } | null
  topCategories: { name: string; total: number }[]
  // 相关性
  recordDays: number
  avgSleep: number | null
  avgMood: number | null
  exerciseDays: number
  insightCount: number
  // 习惯（待模块7完成后填充）
  // 食材
  foodAdded: number
  foodExpired: number
  // 身体
  weightChange: { start: number; end: number } | null
  waistChange: { start: number; end: number } | null
  // 订阅
  subscriptionTotal: number
  activeSubscriptions: number
}

export default function AnnualIndex() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [year])

  const loadData = async () => {
    setLoading(true)
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    // 记账
    const transactions = await db.transactions.where('date').between(startDate, endDate, true, true).toArray()
    const expenses = transactions.filter(t => t.type === 'expense')
    const incomes = transactions.filter(t => t.type === 'income')
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
    const totalIncome = incomes.reduce((s, t) => s + t.amount, 0)
    const savings = totalIncome - totalExpense
    const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0
    const daysInYear = new Date() < new Date(`${year}-12-31`) ? Math.ceil((Date.now() - new Date(startDate).getTime()) / 86400000) : 365
    const monthlyAvg = totalExpense / Math.max(Math.ceil(daysInYear / 30), 1)
    const dailyAvg = totalExpense / Math.max(daysInYear, 1)

    const sortedExp = [...expenses].sort((a, b) => b.amount - a.amount)
    const maxExpense = sortedExp.length > 0 ? { amount: sortedExp[0].amount, note: sortedExp[0].note || '' } : null

    // Top categories
    const categories = await db.categories.toArray()
    const catMap: Record<number, number> = {}
    for (const e of expenses) {
      if (e.category_id) catMap[e.category_id] = (catMap[e.category_id] || 0) + e.amount
    }
    const topCategories = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id, total]) => ({ name: categories.find(c => c.id === Number(id))?.name || '未知', total }))

    // 相关性发现器
    const corrRecords = await db.correlationRecords.where('date').between(startDate, endDate, true, true).toArray()
    const corrDates = new Set(corrRecords.map(r => r.date))
    const recordDays = corrDates.size

    const variables = await db.correlationVariables.toArray()
    const sleepVar = variables.find(v => v.name === '睡眠时长')
    const moodVar = variables.find(v => v.name === '情绪')
    const exerciseVar = variables.find(v => v.name === '运动')

    let avgSleep: number | null = null
    if (sleepVar) {
      const sleepRecs = corrRecords.filter(r => r.variable_id === sleepVar.id!)
      if (sleepRecs.length > 0) avgSleep = sleepRecs.reduce((s, r) => s + r.value, 0) / sleepRecs.length
    }

    let avgMood: number | null = null
    if (moodVar) {
      const moodRecs = corrRecords.filter(r => r.variable_id === moodVar.id!)
      if (moodRecs.length > 0) avgMood = moodRecs.reduce((s, r) => s + r.value, 0) / moodRecs.length
    }

    let exerciseDays = 0
    if (exerciseVar) {
      exerciseDays = corrRecords.filter(r => r.variable_id === exerciseVar.id! && r.value === 1).length
    }

    // 食材
    const foodAll = await db.foodItems.toArray()
    const foodAdded = foodAll.filter(f => f.created_at >= startDate && f.created_at <= endDate + 'T23:59:59').length
    const foodExpired = foodAll.filter(f => f.is_consumed === false && f.expiry_date && f.expiry_date < new Date().toISOString().slice(0, 10)).length

    // 身体
    const bodyMeasurements = await db.bodyMeasurements.toArray()
    const yearWeights = bodyMeasurements.filter(m => m.type === 'weight' && m.date >= startDate && m.date <= endDate).sort((a, b) => a.date.localeCompare(b.date))
    const weightChange = yearWeights.length >= 2 ? { start: yearWeights[0].value, end: yearWeights[yearWeights.length - 1].value } : null
    const yearWaists = bodyMeasurements.filter(m => m.type === 'waist' && m.date >= startDate && m.date <= endDate).sort((a, b) => a.date.localeCompare(b.date))
    const waistChange = yearWaists.length >= 2 ? { start: yearWaists[0].value, end: yearWaists[yearWaists.length - 1].value } : null

    // 订阅
    const subs = await db.subscriptions.toArray()
    const activeSubs = subs.filter(s => s.is_active)
    const subscriptionTotal = activeSubs.reduce((s, sub) => {
      if (sub.cycle === 'monthly') return s + sub.amount * 12
      if (sub.cycle === 'yearly') return s + sub.amount
      if (sub.cycle === 'weekly') return s + sub.amount * 52
      return s
    }, 0)

    setData({
      totalExpense, totalIncome, savings, savingsRate, monthlyAvg, dailyAvg, maxExpense, topCategories,
      recordDays, avgSleep, avgMood, exerciseDays, insightCount: 0,
      foodAdded, foodExpired,
      weightChange, waistChange,
      subscriptionTotal, activeSubscriptions: activeSubs.length,
    })
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#111] text-white">
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between bg-[#111]">
        <Link to="/" className="text-gray-500"><ChevronLeft size={20} /></Link>
        <h1 className="text-base font-semibold">我的年报</h1>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="text-xs bg-[#222] text-gray-400 px-2 py-1 rounded border border-[#333]">
          {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
      </div>

      <div className="px-4 pb-10">
        {/* Hero */}
        <div className="text-center py-8">
          <p className="text-5xl font-extrabold bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">{year}</p>
          <p className="text-sm text-gray-500 mt-1">你的年度数据回顾</p>
        </div>

        {loading || !data ? (
          <p className="text-center text-gray-500 text-sm py-10">加载中...</p>
        ) : (
          <div className="space-y-4">
            {/* 收支 */}
            <Card title="收支总览" icon="💰">
              <BigNum value={`¥${Math.round(data.totalExpense).toLocaleString()}`} label="年度总支出" color="text-red-400" />
              <Row label="年度总收入" value={`¥${Math.round(data.totalIncome).toLocaleString()}`} color="text-green-400" />
              <Row label="年度储蓄" value={`¥${Math.round(data.savings).toLocaleString()} (${data.savingsRate.toFixed(0)}%)`} color="text-green-400" />
              <Row label="月均支出" value={`¥${Math.round(data.monthlyAvg).toLocaleString()}`} />
              <Row label="日均支出" value={`¥${Math.round(data.dailyAvg)}`} />
              {data.maxExpense && <Row label="最大单笔" value={`¥${data.maxExpense.amount} ${data.maxExpense.note ? `(${data.maxExpense.note})` : ''}`} color="text-red-400" />}
              {data.topCategories.length > 0 && <Row label="TOP3 分类" value={data.topCategories.map(c => c.name).join(' / ')} />}
            </Card>

            {/* 订阅 */}
            <Card title="订阅支出" icon="🔄">
              <Row label="年度订阅总支出" value={`¥${Math.round(data.subscriptionTotal).toLocaleString()}`} color="text-indigo-400" />
              <Row label="活跃订阅数" value={`${data.activeSubscriptions} 个`} />
            </Card>

            {/* 相关性 */}
            {data.recordDays > 0 && (
              <Card title="生活规律" icon="🔬">
                <Row label="记录天数" value={`${data.recordDays} 天`} color="text-indigo-400" />
                {data.avgSleep !== null && <Row label="平均睡眠" value={`${data.avgSleep.toFixed(1)}h`} />}
                {data.avgMood !== null && <Row label="平均情绪" value={`${data.avgMood.toFixed(1)} / 5`} />}
                <Row label="运动天数" value={`${data.exerciseDays} 天`} />
              </Card>
            )}

            {/* 食材 */}
            {data.foodAdded > 0 && (
              <Card title="食材管理" icon="🥬">
                <Row label="入库食材" value={`${data.foodAdded} 件`} />
                <Row label="过期浪费" value={`${data.foodExpired} 件`} color={data.foodExpired > 0 ? 'text-red-400' : undefined} />
              </Card>
            )}

            {/* 身体 */}
            {(data.weightChange || data.waistChange) && (
              <Card title="身体变化" icon="📐">
                {data.weightChange && (
                  <Row label="体重变化" value={`${(data.weightChange.end - data.weightChange.start).toFixed(1)} kg (${data.weightChange.start}→${data.weightChange.end})`} color={data.weightChange.end < data.weightChange.start ? 'text-green-400' : 'text-red-400'} />
                )}
                {data.waistChange && (
                  <Row label="腰围变化" value={`${(data.waistChange.end - data.waistChange.start).toFixed(1)} cm (${data.waistChange.start}→${data.waistChange.end})`} color={data.waistChange.end < data.waistChange.start ? 'text-green-400' : 'text-red-400'} />
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[#262626]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  )
}

function BigNum({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="text-center py-2 mb-2">
      <p className={`text-3xl font-extrabold ${color || ''}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-[#262626] last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${color || ''}`}>{value}</span>
    </div>
  )
}
