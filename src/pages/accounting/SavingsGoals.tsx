import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db, type SavingsGoal } from '../../lib/db'

export default function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', icon: '🎯', target: '', current: '0', deadline: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const g = await db.savingsGoals.toArray()
    setGoals(g)
  }

  function openAdd() {
    setForm({ name: '', icon: '🎯', target: '', current: '0', deadline: '' })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(g: SavingsGoal) {
    setForm({ name: g.name, icon: g.icon, target: String(g.target), current: String(g.current), deadline: g.deadline || '' })
    setEditingId(g.id!)
    setShowForm(true)
  }

  async function handleSave() {
    const target = parseFloat(form.target)
    if (!target || !form.name.trim()) return
    const current = parseFloat(form.current) || 0
    if (editingId) {
      await db.savingsGoals.update(editingId, { name: form.name, icon: form.icon, target, current, deadline: form.deadline || null })
    } else {
      await db.savingsGoals.add({ name: form.name, icon: form.icon, target, current, deadline: form.deadline || null, created_at: new Date().toISOString() })
    }
    setShowForm(false)
    loadData()
  }

  async function addMoney(g: SavingsGoal) {
    const input = prompt(`存入金额（目标 ¥${g.target}，已存 ¥${g.current}）:`)
    if (!input) return
    const amount = parseFloat(input)
    if (!amount || amount <= 0) return
    await db.savingsGoals.update(g.id!, { current: g.current + amount })
    loadData()
  }

  async function deleteGoal(id: number) {
    if (!confirm('确定删除此目标？')) return
    await db.savingsGoals.delete(id)
    loadData()
  }

  const totalSaved = goals.reduce((s, g) => s + g.current, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target, 0)

  const iconOptions = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '👗', '💍', '🎓', '🏖️', '🎮', '💰']

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">攒钱目标</h1>
        <button onClick={openAdd} className="text-amber-500 hover:text-amber-600 text-sm font-medium">添加</button>
      </div>

      {/* Overall Progress */}
      {goals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-400 mb-1">总进度</p>
          <p className="text-xl font-bold text-amber-500">¥{totalSaved.toFixed(0)} <span className="text-sm text-gray-400 font-normal">/ ¥{totalTarget.toFixed(0)}</span></p>
          <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <p className="text-gray-400 text-center py-16 text-sm">设一个攒钱目标，开始存钱吧</p>
      ) : (
        <div className="space-y-3">
          {goals.map(g => {
            const percent = g.target > 0 ? (g.current / g.target) * 100 : 0
            const isComplete = percent >= 100
            return (
              <div key={g.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border ${isComplete ? 'border-green-200 dark:border-green-800' : 'border-gray-100 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{g.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{g.name}</p>
                      {g.deadline && (
                        <p className="text-[11px] text-gray-400">截止 {g.deadline}</p>
                      )}
                    </div>
                  </div>
                  {isComplete && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full font-medium">已达成</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>¥{g.current.toFixed(0)} / ¥{g.target.toFixed(0)}</span>
                  <span>{percent.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => addMoney(g)}
                    className="text-xs px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-full font-medium"
                  >
                    + 存入
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(g)} className="text-gray-300 hover:text-amber-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button onClick={() => g.id && deleteGoal(g.id)} className="text-gray-300 hover:text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {editingId ? '编辑目标' : '添加攒钱目标'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">图标</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {iconOptions.map(ico => (
                    <button
                      key={ico}
                      onClick={() => setForm({ ...form, icon: ico })}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center ${form.icon === ico ? 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/30' : 'bg-gray-50 dark:bg-gray-700'}`}
                    >
                      {ico}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">目标名称</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如：买 MacBook" className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400">目标金额</label>
                <input type="number" inputMode="decimal" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}
                  placeholder="如 15000" className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400">已存金额</label>
                <input type="number" inputMode="decimal" value={form.current} onChange={e => setForm({ ...form, current: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400">截止日期（可选）</label>
                <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
              </div>
              <button onClick={handleSave} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
