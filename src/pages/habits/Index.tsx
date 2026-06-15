import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit, type HabitLog } from '../../lib/db'
import { ChevronLeft, ChevronRight, Plus, Check, Settings, Trash2 } from 'lucide-react'

function formatDate(d: Date): string { return d.toISOString().slice(0, 10) }
function getWeekday(d: Date): string { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()] }

export default function HabitsIndex() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const dateStr = formatDate(currentDate)
  const [showManage, setShowManage] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#10b981')

  const habits = useLiveQuery(() => db.habits.filter(h => h.is_active).sortBy('sort_order'))
  const allLogs = useLiveQuery(() => db.habitLogs.toArray())
  const todayLogs = useLiveQuery(() => db.habitLogs.where('date').equals(dateStr).toArray(), [dateStr])

  if (!habits || !allLogs || !todayLogs) return null

  const isToday = dateStr === formatDate(new Date())

  const toggleHabit = async (habitId: number) => {
    const existing = todayLogs.find(l => l.habit_id === habitId)
    if (existing) {
      await db.habitLogs.delete(existing.id!)
    } else {
      await db.habitLogs.add({ habit_id: habitId, date: dateStr, count: 1 } as HabitLog)
    }
  }

  const getStreak = (habitId: number): number => {
    const logs = allLogs.filter(l => l.habit_id === habitId).map(l => l.date).sort().reverse()
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (logs.includes(formatDate(d))) streak++
      else break
    }
    return streak
  }

  const completedToday = habits.filter(h => todayLogs.some(l => l.habit_id === h.id!)).length
  const longestStreak = habits.length > 0 ? Math.max(...habits.map(h => getStreak(h.id!))) : 0

  // Weekly completion rate
  const weekStart = new Date(currentDate)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return formatDate(d) })
  const weekLogs = allLogs.filter(l => weekDates.includes(l.date))
  const weekRate = habits.length > 0 ? Math.round((weekLogs.length / (habits.length * 7)) * 100) : 0

  // Heatmap - current month
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const monthDays: string[] = []
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    monthDays.push(formatDate(new Date(d)))
  }
  // Pad start to align with weekday
  const startPad = (monthStart.getDay() + 6) % 7 // Monday = 0
  const heatmapCells = Array(startPad).fill(null).concat(monthDays)

  const handleAdd = async () => {
    if (!newName.trim()) return
    const maxOrder = habits.length > 0 ? Math.max(...habits.map(h => h.sort_order)) : 0
    await db.habits.add({
      name: newName.trim(),
      icon: '',
      color: newColor,
      frequency: 'daily',
      target_per_day: 1,
      is_active: true,
      sort_order: maxOrder + 1,
      created_at: new Date().toISOString(),
    } as Habit)
    setNewName('')
    setShowAdd(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('删除此习惯？')) return
    await db.habits.update(id, { is_active: false })
  }

  const prevDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d) }
  const nextDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); if (d <= new Date()) setCurrentDate(d) }

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">习惯打卡</h1>
          <button onClick={() => setShowManage(!showManage)} className="text-gray-400"><Settings size={18} /></button>
        </div>
      </div>

      <div className="p-4">
        {/* Date nav */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={prevDay} className="text-gray-400"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {currentDate.getMonth() + 1}月{currentDate.getDate()}日 {getWeekday(currentDate)}
            {isToday && <span className="ml-1 text-xs text-green-500">今天</span>}
          </span>
          <button onClick={nextDay} className={isToday ? 'text-gray-200' : 'text-gray-400'} disabled={isToday}><ChevronRight size={18} /></button>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-2.5 text-center">
            <p className="text-base font-bold text-gray-800 dark:text-white">{completedToday}/{habits.length}</p>
            <p className="text-[10px] text-gray-400">今日完成</p>
          </div>
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-2.5 text-center">
            <p className="text-base font-bold text-gray-800 dark:text-white">🔥 {longestStreak}</p>
            <p className="text-[10px] text-gray-400">最长连续</p>
          </div>
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-2.5 text-center">
            <p className="text-base font-bold text-gray-800 dark:text-white">{weekRate}%</p>
            <p className="text-[10px] text-gray-400">本周完成率</p>
          </div>
        </div>

        {/* Habit list */}
        <div className="space-y-2 mb-4">
          {habits.map(h => {
            const done = todayLogs.some(l => l.habit_id === h.id!)
            const streak = getStreak(h.id!)
            return (
              <div key={h.id} className={`flex items-center gap-3 p-3 rounded-xl ${done ? 'bg-green-50 dark:bg-green-900/10' : 'bg-white dark:bg-[#141416]'}`}>
                <button
                  onClick={() => toggleHabit(h.id!)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    done ? 'border-green-500 bg-green-500' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {done && <Check size={16} className="text-white" />}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${done ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}`}>{h.name}</p>
                  <p className={`text-[10px] ${done ? 'text-green-500' : 'text-gray-400'}`}>
                    {streak > 0 ? `🔥 连续 ${streak} 天` : '未开始'}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: h.color }} />
              </div>
            )
          })}
        </div>

        {/* Heatmap */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{currentDate.getMonth() + 1}月热力图</span>
            <div className="flex items-center gap-1 text-[9px] text-gray-400">
              少 <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 dark:bg-gray-800 inline-block" />
              <span className="w-2.5 h-2.5 rounded-sm bg-green-200 inline-block" />
              <span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" />
              <span className="w-2.5 h-2.5 rounded-sm bg-green-600 inline-block" /> 多
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['一', '二', '三', '四', '五', '六', '日'].map(d => <span key={d} className="text-[9px] text-gray-400">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {heatmapCells.map((day, i) => {
              if (!day) return <div key={i} />
              const count = allLogs.filter(l => l.date === day).length
              const maxCount = habits.length || 1
              const ratio = count / maxCount
              const bg = count === 0 ? 'bg-gray-100 dark:bg-gray-800'
                : ratio < 0.5 ? 'bg-green-200'
                : ratio < 0.8 ? 'bg-green-400'
                : 'bg-green-600'
              const isCurrentDay = day === dateStr
              return (
                <div key={i} className={`aspect-square rounded-sm ${bg} ${isCurrentDay ? 'ring-1 ring-gray-900 dark:ring-white' : ''}`} />
              )
            })}
          </div>
        </div>

        {/* Weekly bar chart */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-3">本周各习惯完成率</p>
          <div className="space-y-2">
            {habits.map(h => {
              const weekCompleted = weekDates.filter(d => allLogs.some(l => l.habit_id === h.id! && l.date === d)).length
              const pct = Math.round((weekCompleted / 7) * 100)
              return (
                <div key={h.id} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 w-12 truncate">{h.name}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: h.color }} />
                  </div>
                  <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Add button */}
        <button onClick={() => setShowAdd(true)} className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 flex items-center justify-center gap-2">
          <Plus size={16} /> 添加习惯
        </button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-[390px] rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">添加习惯</p>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="习惯名称（如 阅读30分钟）" autoFocus className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
            <div className="flex gap-2">
              {['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9'].map(c => (
                <button key={c} onClick={() => setNewColor(c)} className={`w-8 h-8 rounded-full ${newColor === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} style={{ background: c }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">取消</button>
              <button onClick={handleAdd} className="flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage mode - show delete buttons inline */}
      {showManage && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" onClick={() => setShowManage(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-[390px] rounded-t-2xl p-5 space-y-2 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800 dark:text-white mb-2">管理习惯</p>
            {habits.map(h => (
              <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: h.color }} />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{h.name}</span>
                </div>
                <button onClick={() => handleDelete(h.id!)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => setShowManage(false)} className="w-full py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500 mt-3">关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}
