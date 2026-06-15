import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type FoodItem } from '../../lib/db'
import { ChevronLeft, Plus, Check, AlertTriangle } from 'lucide-react'

const STORAGES = [
  { key: 'fridge', label: '冷藏', icon: '🧊' },
  { key: 'freezer', label: '冷冻', icon: '❄️' },
  { key: 'pantry', label: '常温', icon: '🏠' },
] as const

const CATEGORIES = [
  { name: '全部', icon: '📋', color: '#333' },
  { name: '蔬菜', icon: '🥬', color: '#16a34a' },
  { name: '水果', icon: '🍎', color: '#dc2626' },
  { name: '肉类', icon: '🍗', color: '#ea580c' },
  { name: '乳制品', icon: '🧀', color: '#ca8a04' },
  { name: '调味料', icon: '🧂', color: '#7c3aed' },
  { name: '饮品', icon: '🥤', color: '#0284c7' },
  { name: '零食', icon: '🍪', color: '#d946ef' },
  { name: '其他', icon: '📦', color: '#6b7280' },
]

const UNITS = ['个', 'g', 'ml', '包', '盒', '瓶', '袋', '块']

function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiryDate)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000)
}

function expiryLabel(days: number | null): { text: string; color: string } {
  if (days === null) return { text: '无期限', color: 'text-gray-400' }
  if (days < 0) return { text: `已过期${-days}天`, color: 'text-red-500' }
  if (days === 0) return { text: '今天到期', color: 'text-amber-500' }
  if (days === 1) return { text: '明天到期', color: 'text-amber-600' }
  if (days <= 3) return { text: `${days}天后到期`, color: 'text-amber-500' }
  return { text: `还剩${days}天`, color: 'text-green-500' }
}

export default function FoodIndex() {
  const [storageTab, setStorageTab] = useState<'fridge' | 'freezer' | 'pantry'>('fridge')
  const [catFilter, setCatFilter] = useState('全部')
  const [sortBy, setSortBy] = useState<'expiry' | 'created'>('expiry')
  const [showAdd, setShowAdd] = useState(false)

  // Add form
  const [form, setForm] = useState({ name: '', quantity: '1', unit: '个', category: '其他', storage: 'fridge' as string, expiry_date: '', purchase_date: new Date().toISOString().slice(0, 10) })

  const allItems = useLiveQuery(() => db.foodItems.filter(i => !i.is_consumed).toArray())

  if (!allItems) return null

  const filteredItems = allItems
    .filter(i => i.storage === storageTab)
    .filter(i => catFilter === '全部' || i.category === catFilter)
    .sort((a, b) => {
      if (sortBy === 'expiry') {
        if (!a.expiry_date) return 1
        if (!b.expiry_date) return -1
        return a.expiry_date.localeCompare(b.expiry_date)
      }
      return b.created_at.localeCompare(a.created_at)
    })

  const expiringCount = allItems.filter(i => {
    const d = daysUntilExpiry(i.expiry_date)
    return d !== null && d <= 1
  }).length

  const storageCount = (s: string) => allItems.filter(i => i.storage === s).length

  const handleConsume = async (id: number) => {
    await db.foodItems.update(id, { is_consumed: true })
  }

  const handleAdd = async () => {
    if (!form.name.trim()) return
    await db.foodItems.add({
      name: form.name.trim(),
      quantity: Number(form.quantity) || 1,
      unit: form.unit,
      category: form.category,
      storage: form.storage as 'fridge' | 'freezer' | 'pantry',
      purchase_date: form.purchase_date || null,
      expiry_date: form.expiry_date || null,
      is_consumed: false,
      created_at: new Date().toISOString(),
    } as FoodItem)
    setForm({ name: '', quantity: '1', unit: '个', category: '其他', storage: storageTab, expiry_date: '', purchase_date: new Date().toISOString().slice(0, 10) })
    setShowAdd(false)
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">食材库存</h1>
          <button onClick={() => { setForm(f => ({ ...f, storage: storageTab })); setShowAdd(true) }} className="text-gray-600 dark:text-gray-300"><Plus size={20} /></button>
        </div>
      </div>

      <div className="p-4">
        {/* Alert banner */}
        {expiringCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-xs text-red-700 dark:text-red-400 font-medium">有食材即将过期</span>
            <span className="ml-auto text-xs font-semibold text-red-500 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">{expiringCount}</span>
          </div>
        )}

        {/* Storage tabs */}
        <div className="flex gap-2 mb-3">
          {STORAGES.map(s => (
            <button
              key={s.key}
              onClick={() => setStorageTab(s.key)}
              className={`flex-1 py-2.5 rounded-xl text-center border transition-colors ${
                storageTab === s.key
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                  : 'bg-white dark:bg-[#141416] text-gray-500 border-gray-200 dark:border-white/[0.06]'
              }`}
            >
              <span className="text-base block">{s.icon}</span>
              <span className="text-[10px]">{s.label}</span>
              <span className="text-[10px] opacity-60 ml-0.5">{storageCount(s.key)}</span>
            </button>
          ))}
        </div>

        {/* Category capsules */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {CATEGORIES.map(c => {
            const isActive = catFilter === c.name
            return (
              <button
                key={c.name}
                onClick={() => setCatFilter(c.name)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full whitespace-nowrap text-xs font-medium transition-colors"
                style={{
                  background: isActive ? c.color : `${c.color}15`,
                  color: isActive ? '#fff' : c.color,
                }}
              >
                <span className="text-xs">{c.icon}</span>
                {c.name}
              </button>
            )
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-gray-400">{filteredItems.length} 件食材</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-[11px] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-transparent text-gray-600 dark:text-gray-300"
          >
            <option value="expiry">按过期日期 ↑</option>
            <option value="created">按入库时间 ↓</option>
          </select>
        </div>

        {/* Food list */}
        <div className="space-y-2">
          {filteredItems.map(item => {
            const days = daysUntilExpiry(item.expiry_date)
            const { text, color } = expiryLabel(days)
            const borderColor = days !== null && days < 0 ? 'border-l-red-500' : days !== null && days <= 1 ? 'border-l-amber-500' : days !== null && days <= 3 ? 'border-l-yellow-400' : 'border-l-transparent'

            return (
              <div key={item.id} className={`bg-white dark:bg-[#141416] rounded-xl p-3 flex items-center gap-3 border-l-[3px] ${borderColor}`}>
                <span className="text-lg">
                  {CATEGORIES.find(c => c.name === item.category)?.icon || '📦'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {item.category} · {item.purchase_date ? item.purchase_date.slice(5).replace('-', '月') + '日入库' : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-[11px] font-medium ${color}`}>{text}</p>
                  <p className="text-[10px] text-gray-400">{item.quantity}{item.unit}</p>
                </div>
                <button
                  onClick={() => handleConsume(item.id!)}
                  className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:bg-green-50 hover:border-green-400 hover:text-green-500 transition-colors flex-shrink-0"
                >
                  <Check size={14} />
                </button>
              </div>
            )
          })}
          {filteredItems.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">暂无食材</p>
          )}
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-[390px] rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">添加食材</p>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="食材名称" autoFocus className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
            <div className="flex gap-2">
              <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="数量" min="1" className="w-16 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200">
                {CATEGORIES.filter(c => c.name !== '全部').map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400">存储位置</label>
                <select value={form.storage} onChange={e => setForm(f => ({ ...f, storage: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200">
                  {STORAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400">过期日期</label>
                <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">取消</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
