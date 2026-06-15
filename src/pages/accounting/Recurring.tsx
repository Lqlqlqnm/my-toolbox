import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft, Plus, Pencil, Trash2, Play, Pause } from 'lucide-react'
import { db, type RecurringRule, type Category, type Account } from '../../lib/db'
import CategoryIcon from '../../components/CategoryIcon'
import { useModal } from '../../components/Modal'

export default function Recurring() {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    type: 'expense' as 'expense' | 'income',
    amount: '',
    category_id: 0,
    account_id: 0,
    note: '',
    frequency: 'monthly' as RecurringRule['frequency'],
    day_of_month: '1',
  })

  const { showConfirm, showAlert } = useModal()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [r, c, a] = await Promise.all([
      db.recurring.toArray(),
      db.categories.toArray(),
      db.accounts.orderBy('sort_order').filter(a => !a.is_hidden).toArray(),
    ])
    setRules(r)
    setCategories(c)
    setAccounts(a)
  }

  function openAdd() {
    setForm({ type: 'expense', amount: '', category_id: 0, account_id: accounts[0]?.id || 0, note: '', frequency: 'monthly', day_of_month: '1' })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(r: RecurringRule) {
    setForm({
      type: r.type,
      amount: String(r.amount),
      category_id: r.category_id || 0,
      account_id: r.account_id || 0,
      note: r.note,
      frequency: r.frequency,
      day_of_month: String(r.day_of_month || 1),
    })
    setEditingId(r.id!)
    setShowForm(true)
  }

  async function handleSave() {
    const numAmount = parseFloat(form.amount)
    if (!numAmount || numAmount <= 0) return
    const data = {
      type: form.type,
      amount: numAmount,
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      note: form.note,
      frequency: form.frequency,
      day_of_month: parseInt(form.day_of_month) || null,
      tags: [] as string[],
      is_active: true,
      last_generated: null,
    }
    if (editingId) {
      await db.recurring.update(editingId, data)
    } else {
      await db.recurring.add(data)
    }
    setShowForm(false)
    loadData()
  }

  async function toggleActive(r: RecurringRule) {
    await db.recurring.update(r.id!, { is_active: !r.is_active })
    loadData()
  }

  async function deleteRule(id: number) {
    const confirmed = await showConfirm('确定删除此周期规则？')
    if (!confirmed) return
    await db.recurring.delete(id)
    loadData()
  }

  async function generateNow(r: RecurringRule) {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    await db.transactions.add({
      type: r.type,
      amount: r.amount,
      category_id: r.category_id,
      account_id: r.account_id,
      to_account_id: null,
      tags: r.tags,
      note: r.note ? `${r.note}（周期）` : '周期记账',
      date: today,
      book_id: null,
      is_excluded: false,
      is_reconciled: false,
      is_pending: false,
      currency: 'CNY',
      exchange_rate: 1,
      reimbursement: null,
      refund_for: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    // Update account balance
    if (r.type === 'expense' && r.account_id) {
      await db.accounts.where('id').equals(r.account_id).modify(a => { a.balance -= r.amount })
    } else if (r.type === 'income' && r.account_id) {
      await db.accounts.where('id').equals(r.account_id).modify(a => { a.balance += r.amount })
    }
    await db.recurring.update(r.id!, { last_generated: today })
    loadData()
    await showAlert('已生成一笔记录')
  }

  const freqLabels: Record<string, string> = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }
  const catMap = new Map(categories.map(c => [c.id!, c]))
  const acctMap = new Map(accounts.map(a => [a.id!, a]))

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/accounting" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">周期记账</h1>
          <button onClick={openAdd} className="text-gray-600 dark:text-gray-300"><Plus size={20} /></button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-lg mx-auto">
        {/* Info */}
        <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-4">设置周期规则，手动触发生成记录到流水中。</p>

        {/* Rules List */}
        {rules.length === 0 ? (
          <p className="text-gray-400 text-center py-16 text-sm">暂无周期规则</p>
        ) : (
          <div className="space-y-3">
            {rules.map(r => {
              const cat = r.category_id ? catMap.get(r.category_id) : null
              const acct = r.account_id ? acctMap.get(r.account_id) : null
              return (
                <div key={r.id} className={`bg-white dark:bg-[#141416] rounded-xl p-3.5 ${!r.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-300"><CategoryIcon icon={cat?.icon || 'pin'} size={20} /></span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white">
                        {cat?.name || '未分类'}{r.note ? ` · ${r.note}` : ''}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${r.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                      {r.type === 'expense' ? '-' : '+'}¥{r.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {freqLabels[r.frequency]}{r.day_of_month ? ` ${r.day_of_month}日` : ''} · {acct?.name || ''}
                      {r.last_generated ? ` · 上次: ${r.last_generated}` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => generateNow(r)} className="text-amber-500 hover:text-amber-600">
                        <Play size={14} />
                      </button>
                      <button onClick={() => toggleActive(r)} className="text-gray-400 hover:text-gray-600">
                        {r.is_active ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-amber-500">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => r.id && deleteRule(r.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-lg rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
              {editingId ? '编辑规则' : '添加周期规则'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">类型</label>
                <div className="flex gap-2 mt-1">
                  {(['expense', 'income'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 py-2 text-sm rounded-lg ${form.type === t ? (t === 'expense' ? 'bg-red-50 ring-1 ring-red-400 text-red-600' : 'bg-green-50 ring-1 ring-green-400 text-green-600') : 'bg-gray-50 dark:bg-gray-700 text-gray-500'}`}
                    >
                      {t === 'expense' ? '支出' : '收入'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">金额</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="如 2000"
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">分类</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                >
                  <option value={0}>未分类</option>
                  {categories.filter(c => c.type === form.type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">账户</label>
                <select
                  value={form.account_id}
                  onChange={e => setForm({ ...form, account_id: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">频率</label>
                <div className="flex gap-2 mt-1">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setForm({ ...form, frequency: f })}
                      className={`flex-1 py-2 text-xs rounded-lg ${form.frequency === f ? 'bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-400' : 'bg-gray-50 dark:bg-gray-700'}`}
                    >
                      {freqLabels[f]}
                    </button>
                  ))}
                </div>
              </div>
              {(form.frequency === 'monthly' || form.frequency === 'yearly') && (
                <div>
                  <label className="text-xs text-gray-400">每月几号</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.day_of_month}
                    onChange={e => setForm({ ...form, day_of_month: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400">备注</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="如：房租、工资"
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  取消
                </button>
                <button onClick={handleSave} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors">
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
