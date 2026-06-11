import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { db, type Budget, type Category, type Transaction } from '../../lib/db'

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ category_id: 0, amount: '', period: 'monthly' as Budget['period'] })

  const currentMonth = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [year, month] = currentMonth.split('-').map(Number)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const [b, c, t] = await Promise.all([
      db.budgets.toArray(),
      db.categories.where('type').equals('expense').toArray(),
      db.transactions.where('date').between(startDate, endDate, true, false).toArray(),
    ])
    setBudgets(b)
    setCategories(c)
    setTransactions(t)
  }

  const categoryMap = useMemo(() => {
    const m = new Map<number, Category>()
    for (const c of categories) if (c.id) m.set(c.id, c)
    return m
  }, [categories])

  // Calculate spent per category this month
  const spentMap = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of transactions) {
      if (t.type === 'expense' && t.category_id) {
        m.set(t.category_id, (m.get(t.category_id) || 0) + t.amount)
      }
    }
    return m
  }, [transactions])

  const totalBudget = budgets.filter(b => b.period === 'monthly').reduce((s, b) => s + b.amount, 0)
  const totalSpent = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  function openAdd() {
    const unbudgeted = categories.filter(c => !budgets.some(b => b.category_id === c.id))
    setForm({ category_id: unbudgeted[0]?.id || 0, amount: '', period: 'monthly' })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(b: Budget) {
    setForm({ category_id: b.category_id || 0, amount: String(b.amount), period: b.period })
    setEditingId(b.id!)
    setShowForm(true)
  }

  async function handleSave() {
    const numAmount = parseFloat(form.amount)
    if (!numAmount || numAmount <= 0) return
    if (editingId) {
      await db.budgets.update(editingId, { category_id: form.category_id || null, amount: numAmount, period: form.period })
    } else {
      await db.budgets.add({ category_id: form.category_id || null, amount: numAmount, period: form.period, book_id: null })
    }
    setShowForm(false)
    loadData()
  }

  async function deleteBudget(id: number) {
    await db.budgets.delete(id)
    loadData()
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">预算管理</h1>
        <button onClick={openAdd} className="text-amber-500 hover:text-amber-600 text-sm font-medium">添加</button>
      </div>

      {/* Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-xs text-gray-400">本月总预算</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">¥{totalBudget.toFixed(0)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">已花费</p>
            <p className={`text-lg font-semibold ${totalSpent > totalBudget && totalBudget > 0 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
              ¥{totalSpent.toFixed(0)}
            </p>
          </div>
        </div>
        {totalBudget > 0 && (
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${totalSpent / totalBudget > 1 ? 'bg-red-500' : totalSpent / totalBudget > 0.8 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
            />
          </div>
        )}
        {totalBudget > 0 && (
          <p className="text-xs text-gray-400 mt-1 text-right">
            剩余 ¥{Math.max(totalBudget - totalSpent, 0).toFixed(0)} · {((totalSpent / totalBudget) * 100).toFixed(0)}%
          </p>
        )}
      </div>

      {/* Budget List */}
      {budgets.length === 0 ? (
        <p className="text-gray-400 text-center py-16 text-sm">暂未设置预算，点击右上角添加</p>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => {
            const cat = b.category_id ? categoryMap.get(b.category_id) : null
            const spent = b.category_id ? (spentMap.get(b.category_id) || 0) : totalSpent
            const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0
            const isOver = percent > 100
            return (
              <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat?.icon || '📊'}</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {cat?.name || '总预算'}
                    </span>
                    <span className="text-xs text-gray-400">{b.period === 'monthly' ? '月' : '年'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(b)} className="text-gray-300 hover:text-amber-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button onClick={() => b.id && deleteBudget(b.id)} className="text-gray-300 hover:text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>¥{spent.toFixed(0)} / ¥{b.amount.toFixed(0)}</span>
                  <span className={isOver ? 'text-red-500 font-medium' : ''}>{percent.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isOver ? 'bg-red-500' : percent > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
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
              {editingId ? '编辑预算' : '添加预算'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">分类</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600"
                >
                  <option value={0}>全部（总预算）</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">预算金额</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="如 3000"
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">周期</label>
                <div className="flex gap-2 mt-1">
                  {(['monthly', 'yearly'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setForm({ ...form, period: p })}
                      className={`flex-1 py-2 text-sm rounded-lg ${form.period === p ? 'bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-400' : 'bg-gray-50 dark:bg-gray-700'}`}
                    >
                      {p === 'monthly' ? '月度' : '年度'}
                    </button>
                  ))}
                </div>
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
