import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft, Plus, Pencil, Trash2 } from 'lucide-react'
import { db, type Debt } from '../../lib/db'
import { useModal } from '../../components/Modal'

export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'borrow' | 'lend'>('all')
  const [form, setForm] = useState({
    type: 'borrow' as Debt['type'],
    counterparty: '',
    amount: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
    due_date: '',
  })

  const { showConfirm, showPrompt, showAlert } = useModal()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const d = await db.debts.toArray()
    setDebts(d)
  }

  const filtered = debts.filter(d => {
    if (filter === 'all') return true
    return d.type === filter
  })

  const active = filtered.filter(d => !d.is_settled)
  const settled = filtered.filter(d => d.is_settled)

  const totalBorrowed = debts.filter(d => d.type === 'borrow' && !d.is_settled).reduce((s, d) => s + d.remaining, 0)
  const totalLent = debts.filter(d => d.type === 'lend' && !d.is_settled).reduce((s, d) => s + d.remaining, 0)

  function openAdd() {
    setForm({ type: 'borrow', counterparty: '', amount: '', note: '', date: new Date().toISOString().slice(0, 10), due_date: '' })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(d: Debt) {
    setForm({
      type: d.type,
      counterparty: d.counterparty,
      amount: String(d.amount),
      note: d.note,
      date: d.date,
      due_date: d.due_date || '',
    })
    setEditingId(d.id!)
    setShowForm(true)
  }

  async function handleSave() {
    const numAmount = parseFloat(form.amount)
    if (!numAmount || !form.counterparty.trim()) {
      await showAlert('提示', '请填写对方和金额')
      return
    }
    if (editingId) {
      await db.debts.update(editingId, {
        type: form.type,
        counterparty: form.counterparty,
        amount: numAmount,
        note: form.note,
        date: form.date,
        due_date: form.due_date || null,
      })
    } else {
      await db.debts.add({
        type: form.type,
        counterparty: form.counterparty,
        amount: numAmount,
        remaining: numAmount,
        note: form.note,
        date: form.date,
        due_date: form.due_date || null,
        is_settled: false,
        created_at: new Date().toISOString(),
      })
    }
    setShowForm(false)
    loadData()
  }

  async function handleRepay(d: Debt) {
    const input = await showPrompt(`还款金额（剩余 ¥${d.remaining.toFixed(2)}）`, {
      placeholder: '输入还款金额',
      inputType: 'number',
    })
    if (!input) return
    const repay = parseFloat(input)
    if (!repay || repay <= 0) return
    const newRemaining = Math.max(d.remaining - repay, 0)
    await db.debts.update(d.id!, {
      remaining: newRemaining,
      is_settled: newRemaining === 0,
    })
    loadData()
  }

  async function toggleSettle(d: Debt) {
    await db.debts.update(d.id!, { is_settled: !d.is_settled, remaining: d.is_settled ? d.remaining : 0 })
    loadData()
  }

  async function deleteDebt(id: number) {
    const ok = await showConfirm('确认删除', '确定要删除这条记录吗？')
    if (!ok) return
    await db.debts.delete(id)
    loadData()
  }

  function isOverdue(d: Debt) {
    if (!d.due_date || d.is_settled) return false
    return d.due_date < new Date().toISOString().slice(0, 10)
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/accounting" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">借还款</h1>
          <button onClick={openAdd} className="text-gray-600 dark:text-gray-300"><Plus size={20} /></button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-lg mx-auto">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400">我借入的</p>
            <p className="text-lg font-bold text-red-500">¥{totalBorrowed.toFixed(0)}</p>
          </div>
          <div className="bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400">我借出的</p>
            <p className="text-lg font-bold text-green-500">¥{totalLent.toFixed(0)}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {([['all', '全部'], ['borrow', '借入'], ['lend', '借出']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${filter === key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-[#141416] text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active Debts */}
        {active.length === 0 && settled.length === 0 ? (
          <p className="text-gray-400 text-center py-16 text-sm">暂无借还记录</p>
        ) : (
          <>
            {active.length > 0 && (
              <div className="space-y-3 mb-6">
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2">进行中</p>
                {active.map(d => (
                  <div key={d.id} className="bg-white dark:bg-[#141416] rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{d.type === 'borrow' ? '📥' : '📤'}</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-white">{d.counterparty}</span>
                        {isOverdue(d) && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">已逾期</span>}
                      </div>
                      <span className={`text-sm font-semibold ${d.type === 'borrow' ? 'text-red-500' : 'text-green-500'}`}>
                        ¥{d.remaining.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {d.date}{d.due_date ? ` → ${d.due_date}` : ''}{d.note ? ` · ${d.note}` : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleRepay(d)} className="text-xs text-amber-500 font-medium">还款</button>
                        <button onClick={() => toggleSettle(d)} className="text-xs text-green-500 font-medium">结清</button>
                        <button onClick={() => openEdit(d)} className="text-gray-300 hover:text-amber-500">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => d.id && deleteDebt(d.id)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    {d.amount > 0 && (
                      <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${((d.amount - d.remaining) / d.amount) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {settled.length > 0 && (
              <>
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2">已结清</p>
                <div className="space-y-2">
                  {settled.map(d => (
                    <div key={d.id} className="bg-white dark:bg-[#141416] rounded-xl p-3.5 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{d.type === 'borrow' ? '📥' : '📤'}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-300">{d.counterparty}</span>
                          <span className="text-xs text-gray-400">¥{d.amount.toFixed(0)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleSettle(d)} className="text-xs text-gray-400">撤销</button>
                          <button onClick={() => d.id && deleteDebt(d.id)} className="text-gray-300 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-lg rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
              {editingId ? '编辑' : '添加借还'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">类型</label>
                <div className="flex gap-2 mt-1">
                  {(['borrow', 'lend'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 py-2 text-sm rounded-xl ${form.type === t ? (t === 'borrow' ? 'bg-red-50 dark:bg-red-900/20 ring-1 ring-red-400 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-400 text-green-600 dark:text-green-400') : 'bg-gray-50 dark:bg-gray-700 text-gray-500'}`}
                    >
                      {t === 'borrow' ? '我借入（欠别人）' : '我借出（别人欠我）'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">对方</label>
                <input
                  type="text"
                  value={form.counterparty}
                  onChange={e => setForm({ ...form, counterparty: e.target.value })}
                  placeholder="如：张三"
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border-none outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">金额</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border-none outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">借款日期</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border-none outline-none focus:ring-1 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">到期日（可选）</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border-none outline-none focus:ring-1 focus:ring-amber-400" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">备注</label>
                <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="可选" className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border-none outline-none focus:ring-1 focus:ring-amber-400" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-xl">
                  取消
                </button>
                <button onClick={handleSave} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
