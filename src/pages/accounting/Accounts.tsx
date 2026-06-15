import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronUp, ChevronDown, Plus, Pencil, EyeOff, Eye, Trash2, ArrowUpDown } from 'lucide-react'
import { db, type Account, getPendingInstallmentSummary } from '../../lib/db'
import CategoryIcon, { accountIconKeys } from '../../components/CategoryIcon'
import { useModal } from '../../components/Modal'

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [pendingMap, setPendingMap] = useState<Map<number, { total: number; count: number }>>(new Map())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', type: 'debit' as Account['type'], icon: 'debit', balance: '0', credit_limit: '', billing_day: '', payment_day: '' })
  const [sortMode, setSortMode] = useState(false)
  const { showConfirm } = useModal()

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
    const confirmed = await showConfirm('删除账户', '删除账户后不会删除相关交易记录，确定删除？')
    if (!confirmed) return
    await db.accounts.delete(id)
    loadAccounts()
  }

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
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/accounting" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">账户管理</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setSortMode(!sortMode)} className={sortMode ? 'text-amber-500' : 'text-gray-400'}>
              <ArrowUpDown size={18} />
            </button>
            <button onClick={openAdd} className="text-gray-600 dark:text-gray-300"><Plus size={20} /></button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Net Worth */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4 mb-4 text-center">
          <p className="text-[11px] text-gray-400 mb-1">净资产</p>
          <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-gray-800 dark:text-white' : 'text-red-500'}`}>
            ¥{totalBalance.toFixed(2)}
          </p>
        </div>

        {/* Account List */}
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-sm">暂无账户</p>
          ) : (
            accounts.map((a, i) => (
              <div
                key={a.id}
                className={`bg-white dark:bg-[#141416] rounded-xl p-3.5 ${a.is_hidden ? 'opacity-40' : ''}`}
                onClick={() => !sortMode && openEdit(a)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                    <CategoryIcon icon={a.icon} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{a.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {typeLabels[a.type]}
                      {a.type === 'credit' && a.billing_day && a.payment_day && (
                        <span> · 账单日{a.billing_day}号 · 还款日{a.payment_day}号</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${a.balance >= 0 ? 'text-gray-800 dark:text-gray-100' : 'text-red-500'}`}>
                      ¥{a.balance.toFixed(2)}
                    </p>
                    {a.id && pendingMap.has(a.id) && (
                      <p className="text-[10px] text-amber-500">
                        待还 ¥{pendingMap.get(a.id)!.total.toFixed(2)} ({pendingMap.get(a.id)!.count}期)
                      </p>
                    )}
                  </div>
                  {sortMode && (
                    <div className="flex flex-col gap-0.5 ml-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => a.id && moveAccount(a.id, -1)} disabled={i === 0} className="p-1 text-gray-400 disabled:opacity-30">
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => a.id && moveAccount(a.id, 1)} disabled={i === accounts.length - 1} className="p-1 text-gray-400 disabled:opacity-30">
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {!sortMode && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 dark:border-white/[0.04]" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleHidden(a)} className="text-[11px] text-gray-400 flex items-center gap-1">
                      {a.is_hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                      {a.is_hidden ? '显示' : '隐藏'}
                    </button>
                    <button onClick={() => a.id && deleteAccount(a.id)} className="text-[11px] text-gray-400 flex items-center gap-1 ml-auto">
                      <Trash2 size={12} />
                      删除
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-lg rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-4">
              {editingId ? '编辑账户' : '添加账户'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
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
                      className={`flex-1 py-2 text-xs rounded-lg flex items-center justify-center gap-1 ${form.type === t ? 'bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-400' : 'bg-gray-50 dark:bg-gray-800'}`}
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
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {form.type === 'credit' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400">信用额度</label>
                    <input type="number" inputMode="decimal" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })}
                      placeholder="如 50000" className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">账单日（每月几号）</label>
                      <input type="number" min="1" max="28" value={form.billing_day} onChange={e => setForm({ ...form, billing_day: e.target.value })}
                        placeholder="如 6" className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">还款日（每月几号）</label>
                      <input type="number" min="1" max="28" value={form.payment_day} onChange={e => setForm({ ...form, payment_day: e.target.value })}
                        placeholder="如 25" className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">账单周期规则：上月账单日次日 ~ 本月账单日的消费计入本期账单，在还款日前还清。</p>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700">
                  取消
                </button>
                <button onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600">
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
