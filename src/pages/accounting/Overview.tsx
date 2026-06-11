import { useState, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Eye, EyeOff, AlertTriangle, Crown, CreditCard, PieChart, Repeat, Handshake, Target, Calendar, TrendingUp, Zap, Settings, ChevronUp, ChevronDown, EyeOff as EyeOffIcon, Eye as EyeIcon } from 'lucide-react'
import { db, type Account, type Transaction, type Budget, type Category } from '../../lib/db'
import CategoryIcon from '../../components/CategoryIcon'

interface ModuleItem {
  key: string
  icon: React.ReactNode
  label: string
  to: string
  color: string
  visible: boolean
  sort_order: number
}

const DEFAULT_MODULES: ModuleItem[] = [
  { key: 'budget', icon: <PieChart className="w-5 h-5 text-amber-500" />, label: '预算', to: '/accounting/budgets', color: 'bg-amber-50', visible: true, sort_order: 0 },
  { key: 'recurring', icon: <Repeat className="w-5 h-5 text-blue-500" />, label: '周期', to: '/accounting/recurring', color: 'bg-blue-50', visible: true, sort_order: 1 },
  { key: 'debts', icon: <Handshake className="w-5 h-5 text-green-500" />, label: '借还', to: '/accounting/debts', color: 'bg-green-50', visible: true, sort_order: 2 },
  { key: 'savings', icon: <Target className="w-5 h-5 text-red-500" />, label: '攒钱', to: '/accounting/savings', color: 'bg-red-50', visible: true, sort_order: 3 },
  { key: 'calendar', icon: <Calendar className="w-5 h-5 text-purple-500" />, label: '日历', to: '/accounting/list?view=calendar', color: 'bg-purple-50', visible: true, sort_order: 4 },
  { key: 'trend', icon: <TrendingUp className="w-5 h-5 text-indigo-500" />, label: '趋势', to: '/accounting/trend', color: 'bg-indigo-50', visible: true, sort_order: 5 },
  { key: 'templates', icon: <Zap className="w-5 h-5 text-cyan-500" />, label: '模板', to: '/accounting/templates', color: 'bg-cyan-50', visible: true, sort_order: 6 },
  { key: 'credit-cards', icon: <CreditCard className="w-5 h-5 text-pink-500" />, label: '还款', to: '/accounting/credit-cards', color: 'bg-pink-50', visible: true, sort_order: 7 },
]

export default function Overview() {
  const location = useLocation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Map<number, Category>>(new Map())
  const [hideAmount, setHideAmount] = useState(false)
  const [modules, setModules] = useState<ModuleItem[]>(() => {
    const saved = localStorage.getItem('overview_modules')
    if (saved) {
      try {
        const config = JSON.parse(saved) as Array<{ key: string; visible: boolean; sort_order: number }>
        return DEFAULT_MODULES.map(m => {
          const c = config.find(x => x.key === m.key)
          return c ? { ...m, visible: c.visible, sort_order: c.sort_order } : m
        }).sort((a, b) => a.sort_order - b.sort_order)
      } catch { /* use default */ }
    }
    return DEFAULT_MODULES
  })

  useEffect(() => {
    loadData()
  }, [location.key])

  async function loadData() {
    const now = new Date()
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const endDate = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`

    const [accts, txns, bdgs, cats] = await Promise.all([
      db.accounts.orderBy('sort_order').toArray(),
      db.transactions.where('date').between(startDate, endDate, true, false).toArray(),
      db.budgets.toArray(),
      db.categories.toArray(),
    ])
    setAccounts(accts)
    setTransactions(txns)
    setBudgets(bdgs)
    setCategories(new Map(cats.map(c => [c.id!, c])))
  }

  const totalAssets = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts])
  const monthIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions])
  const monthExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions])

  // Budget usage - all budgets for expandable view
  const budgetStatus = useMemo(() => {
    return budgets.map(b => {
      const spent = transactions.filter(t => t.type === 'expense' && t.category_id === b.category_id).reduce((s, t) => s + t.amount, 0)
      const pct = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0
      const cat = b.category_id ? categories.get(b.category_id) : null
      return { ...b, spent, pct, catName: cat?.name || '总预算', catIcon: cat?.icon || '' }
    })
  }, [budgets, transactions, categories])

  // Recent 5 transactions
  const recent = useMemo(() => {
    return [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 5)
  }, [transactions])

  // Credit card interest-free calculation
  const creditCards = useMemo(() => {
    const cards = accounts.filter(a => a.type === 'credit' && a.billing_day && a.payment_day)
    const today = new Date()
    const dayOfMonth = today.getDate()

    return cards.map(card => {
      const billingDay = card.billing_day!
      const paymentDay = card.payment_day!
      // Calculate days until next payment
      let daysUntilPayment: number
      if (dayOfMonth <= paymentDay) {
        daysUntilPayment = paymentDay - dayOfMonth
      } else {
        // Next month
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        daysUntilPayment = daysInMonth - dayOfMonth + paymentDay
      }
      // Interest-free days for new purchase today
      let interestFreeDays: number
      if (dayOfMonth > billingDay) {
        // Past billing day: next billing cycle, max free days
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        interestFreeDays = (daysInMonth - dayOfMonth + billingDay) + (paymentDay > billingDay ? paymentDay - billingDay : 30 - billingDay + paymentDay)
      } else {
        // Before billing day: this cycle
        interestFreeDays = paymentDay >= dayOfMonth ? paymentDay - dayOfMonth : 30 - dayOfMonth + paymentDay
      }
      return { ...card, daysUntilPayment, interestFreeDays }
    }).sort((a, b) => b.interestFreeDays - a.interestFreeDays)
  }, [accounts])

  const visibleModules = modules.filter(m => m.visible)
  const [editingModules, setEditingModules] = useState(false)
  const [budgetExpanded, setBudgetExpanded] = useState(false)

  function saveModules(updated: ModuleItem[]) {
    setModules(updated)
    localStorage.setItem('overview_modules', JSON.stringify(updated.map(m => ({ key: m.key, visible: m.visible, sort_order: m.sort_order }))))
  }

  function toggleModuleVisible(key: string) {
    const updated = modules.map(m => m.key === key ? { ...m, visible: !m.visible } : m)
    saveModules(updated)
  }

  function moveModule(key: string, dir: -1 | 1) {
    const idx = modules.findIndex(m => m.key === key)
    if (idx < 0) return
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= modules.length) return
    const updated = [...modules]
    ;[updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]]
    updated.forEach((m, i) => m.sort_order = i)
    saveModules(updated)
  }

  const formatAmount = (n: number) => hideAmount ? '****' : `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

  return (
    <main className="px-4 pt-3 pb-20">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button onClick={() => setHideAmount(!hideAmount)} className="text-gray-400 p-1">
          {hideAmount ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button onClick={() => setEditingModules(!editingModules)} className={`p-1 ${editingModules ? 'text-amber-500' : 'text-gray-400'}`}>
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Asset Card */}
      <div className="rounded-xl p-5 mb-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1f2937, #111827)' }}>
        <div className="flex justify-between text-xs opacity-60 mb-2">
          <span>净资产</span>
          <span>{new Date().getFullYear()}年{new Date().getMonth() + 1}月</span>
        </div>
        <p className="text-2xl font-bold">{formatAmount(totalAssets)}</p>
        <div className="flex justify-between mt-3 text-xs">
          <div><p className="opacity-60">收入</p><p className="text-green-400 font-medium mt-0.5">+{hideAmount ? '****' : monthIncome.toFixed(2)}</p></div>
          <div><p className="opacity-60">支出</p><p className="text-red-400 font-medium mt-0.5">-{hideAmount ? '****' : monthExpense.toFixed(2)}</p></div>
          <div><p className="opacity-60">结余</p><p className="text-amber-400 font-medium mt-0.5">{hideAmount ? '****' : (monthIncome - monthExpense).toFixed(2)}</p></div>
        </div>
        {budgetStatus.length > 0 && (
          <div className="mt-3 h-1.5 bg-white/10 rounded-full">
            <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (monthExpense / (budgetStatus.reduce((s, b) => s + b.amount, 0) || 1)) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
          </div>
        )}
      </div>

      {/* Budget Warning */}
      {budgetStatus.some(b => b.pct >= 80) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">
            {budgetStatus.filter(b => b.pct >= 80).length} 项预算接近上限，注意控制开支
          </p>
        </div>
      )}

      {/* Quick Tools - horizontal scroll pills */}
      {editingModules ? (
        <div className="mb-5 bg-white dark:bg-[#141416] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">编辑模块</p>
            <button onClick={() => setEditingModules(false)} className="text-xs text-amber-500 font-medium">完成</button>
          </div>
          <div className="space-y-2">
            {modules.map((m, idx) => (
              <div key={m.key} className="flex items-center gap-3 py-2 px-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
                {m.icon}
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{m.label}</span>
                <button onClick={() => moveModule(m.key, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => moveModule(m.key, 1)} disabled={idx === modules.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={() => toggleModuleVisible(m.key)} className={`p-1 ${m.visible ? 'text-green-500' : 'text-gray-300'}`}>
                  {m.visible ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {visibleModules.filter(m => m.key !== 'budget').map(m => (
            <Link key={m.key} to={m.to} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm whitespace-nowrap shrink-0">
              {m.icon}
              <span className="text-xs text-gray-600 dark:text-gray-300">{m.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Budget Card - expandable */}
      {budgetStatus.length > 0 && (
        <div className="mb-5">
          {/* Summary row */}
          <button onClick={() => setBudgetExpanded(!budgetExpanded)} className="w-full rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden text-left">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 dark:hidden" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">本月预算</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-600">
                  {hideAmount ? '****' : `¥${budgetStatus.reduce((s, b) => s + b.spent, 0).toFixed(0)}`} / ¥{budgetStatus.reduce((s, b) => s + b.amount, 0).toFixed(0)}
                </span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${budgetExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </div>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full">
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (budgetStatus.reduce((s, b) => s + b.spent, 0) / (budgetStatus.reduce((s, b) => s + b.amount, 0) || 1)) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5">
              剩余 ¥{hideAmount ? '****' : (budgetStatus.reduce((s, b) => s + b.amount, 0) - budgetStatus.reduce((s, b) => s + b.spent, 0)).toFixed(0)}
            </p>
          </button>

          {/* Expanded: per-category breakdown */}
          {budgetExpanded && (
            <div className="mt-2 space-y-2">
              {budgetStatus.map(b => (
                <div key={b.id} className="rounded-xl p-3 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${b.pct >= 80 ? 'bg-red-400' : b.pct >= 50 ? 'bg-amber-400' : 'bg-green-400'} dark:hidden`} />
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                      <CategoryIcon icon={b.catIcon || 'pin'} size={16} />
                      {b.catName}
                    </span>
                    <span className={`text-xs font-medium ${b.pct >= 80 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-600'}`}>
                      {hideAmount ? '****' : `¥${b.spent.toFixed(0)}`} / ¥{b.amount}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full">
                    <div className={`h-1.5 rounded-full ${b.pct >= 80 ? 'bg-red-400' : b.pct >= 50 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${b.pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
                    剩余 ¥{hideAmount ? '****' : (b.amount - b.spent).toFixed(0)} · 已用 {b.pct.toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Credit Card Interest-Free */}
      {creditCards.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">信用卡免息</p>
            <Link to="/accounting/credit-cards" className="text-xs text-amber-500">管理 →</Link>
          </div>
          <div className="bg-white dark:bg-[#141416] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
            {/* Best card */}
            {creditCards[0] && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2.5 mb-3 flex items-center gap-3">
                <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">今日最优刷卡</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{creditCards[0].name} · 免息 <span className="text-amber-600">{creditCards[0].interestFreeDays}天</span></p>
                </div>
              </div>
            )}
            {/* List */}
            <div className="space-y-2">
              {creditCards.map(card => (
                <div key={card.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> {card.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${card.interestFreeDays > 40 ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {card.interestFreeDays}天
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">最近交易</p>
        <Link to="/accounting/list" className="text-xs text-amber-500">全部 →</Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-gray-400 text-center py-8 text-sm">暂无记录</p>
      ) : (
        <div className="space-y-2">
          {recent.map(t => {
            const cat = t.category_id ? categories.get(t.category_id) : null
            const displayName = t.type === 'transfer' ? '转账' : cat?.name || '未分类'
            const systemNotePattern = /^分期\s?\d+\/\d+/
            const displayNote = t.note && !systemNotePattern.test(t.note) ? t.note : ''
            const iconBgMap: Record<string, string> = { expense: 'bg-red-500/10', income: 'bg-green-500/10', transfer: 'bg-blue-500/10' }
            const barColorMap: Record<string, string> = { expense: 'bg-red-400', income: 'bg-green-400', transfer: 'bg-blue-400' }
            const textColorMap: Record<string, string> = { expense: 'text-red-500 dark:text-red-400', income: 'text-green-500 dark:text-green-400', transfer: 'text-blue-500 dark:text-blue-400' }
            return (
            <Link key={t.id} to={`/accounting/edit/${t.id}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${barColorMap[t.type]} dark:hidden`} />
              <div className={`w-8 h-8 rounded-lg ${iconBgMap[t.type]} flex items-center justify-center`}>
                <span className="text-sm">{t.type === 'transfer' ? '🔄' : <CategoryIcon icon={cat?.icon || 'pin'} size={18} />}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">
                  {displayName}{displayNote ? ` - ${displayNote}` : ''}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-600">{t.date}</p>
              </div>
              <span className={`text-sm font-medium ${textColorMap[t.type]}`}>
                {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{hideAmount ? '****' : t.amount.toFixed(2)}
              </span>
            </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}