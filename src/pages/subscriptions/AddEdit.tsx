import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db, type Subscription } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Trash2 } from 'lucide-react'

const CATEGORIES = ['视频', '音乐', '工具', '云服务', '其他']
const OWNERS = ['我', '爱人', '共用']
const PLATFORMS = ['App Store', '微信', '支付宝', '信用卡直扣', '其他']
const CYCLES = [
  { value: 'monthly', label: '月付' },
  { value: 'yearly', label: '年付' },
  { value: 'weekly', label: '周付' },
] as const
const ICONS = ['🎬', '🎵', '🤖', '☁️', '📺', '🎮', '📐', '💻', '📱', '🔧', '📚', '🎧']

function calcNextBilling(startDate: string, cycle: string, billingDay: number | null): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (cycle === 'monthly') {
    const day = billingDay || new Date(startDate).getDate()
    let next = new Date(today.getFullYear(), today.getMonth(), day)
    if (next <= today) next.setMonth(next.getMonth() + 1)
    return next.toISOString().slice(0, 10)
  }
  if (cycle === 'yearly') {
    const start = new Date(startDate)
    let next = new Date(today.getFullYear(), start.getMonth(), start.getDate())
    if (next <= today) next.setFullYear(next.getFullYear() + 1)
    return next.toISOString().slice(0, 10)
  }
  // weekly
  const start = new Date(startDate)
  let next = new Date(start)
  while (next <= today) next.setDate(next.getDate() + 7)
  return next.toISOString().slice(0, 10)
}

export default function AddEdit() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const existing = useLiveQuery(
    () => id ? db.subscriptions.get(Number(id)) : undefined,
    [id]
  )

  const accounts = useLiveQuery(() => db.accounts.orderBy('sort_order').toArray())

  const [form, setForm] = useState({
    name: '',
    amount: '',
    currency: 'CNY',
    cycle: 'monthly' as 'monthly' | 'yearly' | 'weekly',
    billing_day: '',
    start_date: new Date().toISOString().slice(0, 10),
    owner: '我',
    platform: '',
    pay_account_id: null as number | null,
    category: '工具',
    icon: '🤖',
    color: '#6366f1',
    auto_renew: true,
    note: '',
  })

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        amount: String(existing.amount),
        currency: existing.currency,
        cycle: existing.cycle,
        billing_day: existing.billing_day ? String(existing.billing_day) : '',
        start_date: existing.start_date,
        owner: existing.owner,
        platform: existing.platform,
        pay_account_id: existing.pay_account_id,
        category: existing.category,
        icon: existing.icon,
        color: existing.color,
        auto_renew: existing.auto_renew,
        note: existing.note,
      })
    }
  }, [existing])

  const handleSave = async () => {
    if (!form.name || !form.amount) return

    const billingDay = form.billing_day ? Number(form.billing_day) : null
    const nextBilling = calcNextBilling(form.start_date, form.cycle, billingDay)

    const data: Omit<Subscription, 'id'> = {
      name: form.name.trim(),
      amount: Number(form.amount),
      currency: form.currency,
      cycle: form.cycle,
      billing_day: billingDay,
      start_date: form.start_date,
      next_billing_date: nextBilling,
      owner: form.owner,
      platform: form.platform,
      pay_account_id: form.pay_account_id,
      category: form.category,
      icon: form.icon,
      color: form.color,
      auto_renew: form.auto_renew,
      is_active: true,
      note: form.note,
      created_at: new Date().toISOString(),
    }

    if (isEdit) {
      await db.subscriptions.update(Number(id), { ...data, is_active: existing?.is_active ?? true })
    } else {
      await db.subscriptions.add(data as Subscription)
    }

    navigate('/subscriptions')
  }

  const handleDelete = async () => {
    if (!confirm('确定删除此订阅？')) return
    await db.subscriptions.delete(Number(id))
    navigate('/subscriptions')
  }

  const handleTogglePause = async () => {
    if (!existing) return
    await db.subscriptions.update(Number(id), { is_active: !existing.is_active })
    navigate('/subscriptions')
  }

  const update = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/subscriptions')} className="text-gray-400"><ChevronLeft size={20} /></button>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">{isEdit ? '编辑订阅' : '添加订阅'}</h1>
          <div className="w-5" />
        </div>
      </div>

      <div className="p-4 space-y-4 pb-32">
        {/* Icon selector */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-2">图标</p>
          <div className="flex flex-wrap gap-2">
            {ICONS.map(ic => (
              <button
                key={ic}
                onClick={() => update('icon', ic)}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center ${form.icon === ic ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-400' : 'bg-gray-50 dark:bg-gray-800'}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Basic info */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4 space-y-3">
          <input
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="订阅名称"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
          />
          <div className="flex gap-2">
            <select value={form.currency} onChange={e => update('currency', e.target.value)} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200">
              <option value="CNY">¥</option>
              <option value="USD">$</option>
            </select>
            <input
              type="number"
              value={form.amount}
              onChange={e => update('amount', e.target.value)}
              placeholder="金额"
              className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
            />
          </div>
          {/* Cycle */}
          <div className="flex gap-2">
            {CYCLES.map(c => (
              <button
                key={c.value}
                onClick={() => update('cycle', c.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium ${form.cycle === c.value ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {form.cycle === 'monthly' && (
            <input
              type="number"
              value={form.billing_day}
              onChange={e => update('billing_day', e.target.value)}
              placeholder="每月几号扣费 (1-31)"
              min="1" max="31"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
            />
          )}
          <input
            type="date"
            value={form.start_date}
            onChange={e => update('start_date', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200"
          />
        </div>

        {/* Category & Owner */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-2">分类</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => update('category', c)} className={`px-3 py-1.5 rounded-full text-xs ${form.category === c ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">归属人</p>
            <div className="flex flex-wrap gap-2">
              {OWNERS.map(o => (
                <button key={o} onClick={() => update('owner', o)} className={`px-3 py-1.5 rounded-full text-xs ${form.owner === o ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{o}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">付费平台</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => update('platform', p)} className={`px-3 py-1.5 rounded-full text-xs ${form.platform === p ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Pay account */}
        {accounts && accounts.length > 0 && (
          <div className="bg-white dark:bg-[#141416] rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">默认扣款账户（联动记账）</p>
            <select
              value={form.pay_account_id ?? ''}
              onChange={e => update('pay_account_id', e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="">不关联</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Note */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4">
          <textarea
            value={form.note}
            onChange={e => update('note', e.target.value)}
            placeholder="备注（可选）"
            className="w-full border border-gray-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm resize-none h-16 outline-none focus:border-indigo-400 bg-transparent text-gray-700 dark:text-gray-200"
          />
        </div>

        {/* Edit actions */}
        {isEdit && existing && (
          <div className="flex gap-2">
            <button
              onClick={handleTogglePause}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              {existing.is_active ? '暂停订阅' : '恢复订阅'}
            </button>
            <button
              onClick={handleDelete}
              className="py-2.5 px-4 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] p-4 pb-7 bg-gradient-to-t from-[#f4f4f5] dark:from-[#0c0c0d] to-transparent">
        <button
          onClick={handleSave}
          className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900"
        >
          {isEdit ? '保存修改' : '添加订阅'}
        </button>
      </div>
    </div>
  )
}
