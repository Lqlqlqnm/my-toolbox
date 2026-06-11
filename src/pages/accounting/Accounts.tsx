import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { db, type Account, getPendingInstallmentSummary } from '../../lib/db'
import CategoryIcon, { accountIconKeys } from '../../components/CategoryIcon'

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [pendingMap, setPendingMap] = useState<Map<number, { total: number; count: number }>>(new Map())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', type: 'debit' as Account['type'], icon: 'debit', balance: '0', credit_limit: '', billing_day: '', payment_day: '' })

  useEffect(() => { loadAccounts() }, [])

  async function loadAccounts() {
    const accts = await db.accounts.orderBy('sort_order').toArray()
    setAccounts(accts)
    const pending = await getPendingInstallmentSummary()
    setPendingMap(pending)
  }

  function openAdd() {
    setForm({ name: '', type: 'debit', icon: 'debit', balance: '0', credit_limit: '', billing_day: '', payment_day: '' })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(a: Account) {
    setForm({ name: a.name, type: a.type, icon: a.icon, balance: String(a.balance), credit_limit: a.credit_limit ? String(a.credit_limit) : '', billing_day: a.billing_day ? String(a.billing_day) : '', payment_day: a.payment_day ? String(a.payment_day) : '' })
    setEditingId(a.id!)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    const creditFields = form.type === 'credit' ? {
      credit_limit: parseFloat(form.credit_limit) || undefined,
      billing_day: parseInt(form.billing_day) || undefined,
      payment_day: parseInt(form.payment_day) || undefined,
    } : { credit_limit: undefined, billing_day: undefined, payment_day: undefined }

    if (editingId) {
      await db.accounts.update(editingId, {
        name: form.name,
        type: form.type,
        icon: form.icon,
        balance: parseFloat(form.balance) || 0,
        ...creditFields,
      })
    } else {
      const maxOrder = accounts.length > 0 ? Math.max(...accounts.map(a => a.sort_order)) : 0
      await db.accounts.add({
        name: form.name,
        type: form.type,
        icon: form.icon,
        balance: parseFloat(form.balance) || 0,
        currency: 'CNY',
        sort_order: maxOrder + 1,
        is_hidden: false,
        created_at: new Date().toISOString(),
        ...creditFields,
      })
    }
    setShowForm(false)
    loadAccounts()
  }

  async function toggleHidden(a: Account) {
    await db.accounts.update(a.id!, { is_hidden: !a.is_hidden })
    loadAccounts()
  }

  async function deleteAccount(id: number) {
    if (!confirm('删除账户后不会删除相关交易记录，确定？')) return
    await db.accounts.delete(id)
    loadAccounts()
  }

  const [sortMode, setSortMode] = useState(false)

  async function moveAccount(id: number, dir: -1 | 1) {
    const idx = accounts.findIndex(a => a.id === id)
    if (idx < 0) return
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= accounts.length) return
    const current = accounts[idx]
    const target = accounts[targetIdx]
    await db.accounts.update(current.id!, { sort_order: target.sort_order })
    await db.accounts.update(target.id!, { sort_order: current.sort_order })
    loadAccounts()
  }

  const totalBalance = accounts.filter(a => !a.is_hidden).reduce((s, a) => s + a.balance, 0)

  const typeLabels: Record<Account['type'], string> = { cash: '现金', debit: '储蓄卡', credit: '信用卡', ewallet: '电子钱包' }
  const typeIcons = accountIconKeys
  const typeOptions: Account['type'][] = ['cash', 'debit', 'credit', 'ewallet']

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">账户管理</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setSortMode(!sortMode)} className={`text-xs px-2 py-1 rounded ${sortMode ? 'bg-amber-100 text-amber-600' : 'text-gray-400 hover:text-amber-500'}`}>
            {sortMode ? '完成' : '排序'}
          </button>
          <button onClick={openAdd} className="text-amber-500 hover:text-amber-600 text-sm font-medium">添加</button>
        </div>
      </div>

      {/* Net Worth */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-400 mb-1">净资产</p>
        <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-gray-800 dark:text-gray-100' : 'text-red-500'}`}>
          ¥{totalBalance.toFixed(2)}
        </p>
      </div>

      {/* Account List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
        {accounts.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-sm">暂无账户</p>
        ) : (
          accounts.map((a, i) => (
            <div key={a.id} className={`flex items-center px-4 py-3 ${i > 0 ? 'border-t border-gray-50 dark:border-gray-700' : ''} ${a.is_hidden ? 'opacity-40' : ''}`}>
              <span className="mr-3 text-gray-600 dark:text-gray-300"><CategoryIcon icon={a.icon} size={22} /></span>
              <div className="flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-100">{a.name}</p>
                <p className="text-xs text-gray-400">
                  {typeLabels[a.type]}
                  {a.type === 'credit' && a.billing_day && a.payment_day && (
                    <span className="ml-1">· 账单日{a.billing_day}号 · 还款日{a.payment_day}号</span>
                  )}
                </p>
              </div>
              <div className="text-right mr-3">
                <span className={`text-sm font-medium ${a.balance >= 0 ? 'text-gray-700 dark:text-gray-200' : 'text-red-500'}`}>
                  ¥{a.balance.toFixed(2)}
                </span>
                {a.id && pendingMap.has(a.id) && (
                  <p className="text-[10px] text-amber-500">
                    待还 ¥{pendingMap.get(a.id)!.total.toFixed(2)} ({pendingMap.get(a.id)!.count}期)
                  </p>
                )}
              </div>
              {sortMode ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => a.id && moveAccount(a.id, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => a.id && moveAccount(a.id, 1)} disabled={i === accounts.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => openEdit(a)} className="text-gray-300 hover:text-amber-500 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button onClick={() => toggleHidden(a)} className="text-gray-300 hover:text-gray-500 mr-2">
                {a.is_hidden ? '👁' : '🙈'}
              </button>
              <button onClick={() => a.id && deleteAccount(a.id)} className="text-gray-300 hover:text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {editingId ? '编辑账户' : '添加账户'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600"
                  placeholder="如：招商银行"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">类型</label>
                <div className="flex gap-2 mt-1">
                  {typeOptions.map((t, idx) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t, icon: typeIcons[idx] })}
                      className={`flex-1 py-2 text-xs rounded-lg flex items-center justify-center gap-1 ${form.type === t ? 'bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-400' : 'bg-gray-50 dark:bg-gray-700'}`}
                    >
                      <CategoryIcon icon={typeIcons[idx]} size={14} /> {typeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">{form.type === 'credit' ? '当前欠款（负数）' : '当前余额'}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.balance}
                  onChange={e => setForm({ ...form, balance: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600"
                />
              </div>

              {form.type === 'credit' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400">信用额度</label>
                    <input type="number" inputMode="decimal" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })}
                      placeholder="如 50000" className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">账单日（每月几号）</label>
                      <input type="number" min="1" max="28" value={form.billing_day} onChange={e => setForm({ ...form, billing_day: e.target.value })}
                        placeholder="如 6" className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">还款日（每月几号）</label>
                      <input type="number" min="1" max="28" value={form.payment_day} onChange={e => setForm({ ...form, payment_day: e.target.value })}
                        placeholder="如 25" className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">账单周期规则：上月账单日次日 ~ 本月账单日的消费计入本期账单，在还款日前还清。</p>
                </>
              )}

              <button
                onClick={handleSave}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
