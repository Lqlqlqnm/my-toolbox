import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { db, type Transaction, type Category, type Book, type Account } from '../../lib/db'
import CategoryIcon from '../../components/CategoryIcon'

type ViewMode = 'monthly' | 'yearly' | 'custom'

export default function Stats() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedBookId, setSelectedBookId] = useState<number | null | 'all'>('all')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense')
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    loadData()
  }, [currentMonth, currentYear, selectedBookId, viewMode, customStart, customEnd])

  async function loadData() {
    let startDate: string, endDate: string

    if (viewMode === 'monthly') {
      const [year, month] = currentMonth.split('-').map(Number)
      startDate = `${year}-${String(month).padStart(2, '0')}-01`
      endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
    } else if (viewMode === 'yearly') {
      startDate = `${currentYear}-01-01`
      endDate = `${currentYear + 1}-01-01`
    } else {
      startDate = customStart
      endDate = customEnd ? `${customEnd.slice(0, 10)}~` : new Date().toISOString().slice(0, 10)
      // Make endDate exclusive (next day)
      const ed = new Date(customEnd)
      ed.setDate(ed.getDate() + 1)
      endDate = ed.toISOString().slice(0, 10)
    }

    let txns = await db.transactions
      .where('date')
      .between(startDate, endDate, true, false)
      .toArray()

    if (selectedBookId !== 'all') {
      txns = txns.filter(t => t.book_id === selectedBookId)
    }
    // Exclude is_excluded
    txns = txns.filter(t => !t.is_excluded)

    const cats = await db.categories.toArray()
    const bks = await db.books.filter(b => !b.is_archived).toArray()
    const accs = await db.accounts.toArray()
    setTransactions(txns)
    setCategories(cats)
    setBooks(bks)
    setAccounts(accs)
  }

  const categoryMap = useMemo(() => {
    const m = new Map<number, Category>()
    for (const c of categories) if (c.id) m.set(c.id, c)
    return m
  }, [categories])

  const breakdown = useMemo(() => {
    const map = new Map<number, number>()
    let total = 0
    for (const t of transactions) {
      if (t.type !== viewType || !t.category_id) continue
      total += t.amount
      map.set(t.category_id, (map.get(t.category_id) || 0) + t.amount)
    }
    const items = Array.from(map.entries())
      .map(([catId, amt]) => ({
        category: categoryMap.get(catId),
        amount: amt,
        percent: total > 0 ? (amt / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
    return { total, items }
  }, [transactions, viewType, categoryMap])

  // Daily/Monthly trend depending on mode
  const trendData = useMemo(() => {
    if (viewMode === 'yearly') {
      // Monthly totals for the year
      const data = Array(12).fill(0)
      for (const t of transactions) {
        if (t.type !== viewType) continue
        const month = parseInt(t.date.split('-')[1]) - 1
        data[month] += t.amount
      }
      return data
    } else {
      // Daily totals
      const [year, month] = viewMode === 'monthly'
        ? currentMonth.split('-').map(Number)
        : [new Date(customStart).getFullYear(), new Date(customStart).getMonth() + 1]
      const days = viewMode === 'monthly'
        ? new Date(year, month, 0).getDate()
        : Math.ceil((new Date(customEnd).getTime() - new Date(customStart).getTime()) / 86400000) + 1
      const data = Array(days).fill(0)
      for (const t of transactions) {
        if (t.type !== viewType) continue
        if (viewMode === 'monthly') {
          const day = parseInt(t.date.split('-')[2]) - 1
          data[day] += t.amount
        } else {
          const dayIdx = Math.floor((new Date(t.date).getTime() - new Date(customStart).getTime()) / 86400000)
          if (dayIdx >= 0 && dayIdx < days) data[dayIdx] += t.amount
        }
      }
      return data
    }
  }, [transactions, currentMonth, viewType, viewMode, customStart, customEnd])

  const maxTrend = Math.max(...trendData, 1)

  // Step 1: Overview stats
  const overview = useMemo(() => {
    const filtered = transactions.filter(t => t.type === viewType)
    const count = filtered.length
    const maxSingle = count > 0 ? Math.max(...filtered.map(t => t.amount)) : 0
    const days = trendData.length || 1
    const dailyAvg = breakdown.total / days
    return { count, maxSingle, dailyAvg }
  }, [transactions, viewType, breakdown.total, trendData.length])

  // Step 2: Tag analysis
  const tagBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    let total = 0
    for (const t of transactions) {
      if (t.type !== viewType) continue
      total += t.amount
      if (t.tags && t.tags.length > 0) {
        for (const tag of t.tags) {
          map.set(tag, (map.get(tag) || 0) + t.amount)
        }
      } else {
        map.set('无标签', (map.get('无标签') || 0) + t.amount)
      }
    }
    return Array.from(map.entries())
      .map(([tag, amt]) => ({ tag, amount: amt, percent: total > 0 ? (amt / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, viewType])

  // Step 2: Account analysis
  const accountBreakdown = useMemo(() => {
    const map = new Map<number | null, number>()
    let total = 0
    for (const t of transactions) {
      if (t.type !== viewType) continue
      total += t.amount
      map.set(t.account_id, (map.get(t.account_id) || 0) + t.amount)
    }
    const accountMap = new Map(accounts.map(a => [a.id!, a]))
    return Array.from(map.entries())
      .map(([accId, amt]) => ({
        account: accId ? accountMap.get(accId) : null,
        amount: amt,
        percent: total > 0 ? (amt / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, viewType, accounts])

  // Step 3: Month-over-month comparison (only in monthly mode)
  const [lastMonthTxns, setLastMonthTxns] = useState<Transaction[]>([])
  useEffect(() => {
    if (viewMode !== 'monthly') return
    const [year, month] = currentMonth.split('-').map(Number)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-01`
    db.transactions.where('date').between(startDate, endDate, true, false).toArray().then(txns => {
      let filtered = txns.filter(t => !t.is_excluded)
      if (selectedBookId !== 'all') filtered = filtered.filter(t => t.book_id === selectedBookId)
      setLastMonthTxns(filtered)
    })
  }, [viewMode, currentMonth, selectedBookId])

  const monthComparison = useMemo(() => {
    if (viewMode !== 'monthly') return []
    const thisMap = new Map<number, number>()
    const lastMap = new Map<number, number>()
    for (const t of transactions) {
      if (t.type !== viewType || !t.category_id) continue
      thisMap.set(t.category_id, (thisMap.get(t.category_id) || 0) + t.amount)
    }
    for (const t of lastMonthTxns) {
      if (t.type !== viewType || !t.category_id) continue
      lastMap.set(t.category_id, (lastMap.get(t.category_id) || 0) + t.amount)
    }
    const allCatIds = new Set([...thisMap.keys(), ...lastMap.keys()])
    return Array.from(allCatIds)
      .map(catId => {
        const thisAmt = thisMap.get(catId) || 0
        const lastAmt = lastMap.get(catId) || 0
        const change = lastAmt > 0 ? ((thisAmt - lastAmt) / lastAmt) * 100 : (thisAmt > 0 ? 100 : 0)
        return { category: categoryMap.get(catId), thisAmt, lastAmt, change }
      })
      .filter(item => item.thisAmt > 0 || item.lastAmt > 0)
      .sort((a, b) => b.thisAmt - a.thisAmt)
  }, [transactions, lastMonthTxns, viewType, viewMode, categoryMap])

  // Step 4: Top expenses
  const topExpenses = useMemo(() => {
    return transactions
      .filter(t => t.type === viewType)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
  }, [transactions, viewType])

  // Step 4: Monthly balance trend (last 6 months)
  const [balanceTrend, setBalanceTrend] = useState<Array<{ month: string; income: number; expense: number; balance: number }>>([])
  useEffect(() => {
    loadBalanceTrend()
  }, [selectedBookId])

  async function loadBalanceTrend() {
    const now = new Date()
    const months: Array<{ month: string; income: number; expense: number; balance: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endMonth = month === 12 ? 1 : month + 1
      const endYear = month === 12 ? year + 1 : year
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
      let txns = await db.transactions.where('date').between(startDate, endDate, true, false).toArray()
      txns = txns.filter(t => !t.is_excluded)
      if (selectedBookId !== 'all') txns = txns.filter(t => t.book_id === selectedBookId)
      const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      months.push({ month: `${month}月`, income, expense, balance: income - expense })
    }
    setBalanceTrend(months)
  }

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    setCurrentMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    setCurrentMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`)
  }

  const barColors = viewType === 'expense' ? 'bg-red-400' : 'bg-green-400'

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">统计</h1>
        <div className="w-5" />
      </div>

      {/* View Mode Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 mb-4">
        {([['monthly', '月度'], ['yearly', '年度'], ['custom', '自定义']] as [ViewMode, string][]).map(([mode, label]) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`flex-1 py-1.5 text-xs rounded-md font-medium ${viewMode === mode ? 'bg-white dark:bg-gray-700 shadow-sm text-amber-600' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Book Filter */}
      {books.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          <button onClick={() => setSelectedBookId('all')} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${selectedBookId === 'all' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}>全部</button>
          <button onClick={() => setSelectedBookId(null)} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${selectedBookId === null ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}>默认</button>
          {books.map(b => (
            <button key={b.id} onClick={() => setSelectedBookId(b.id!)} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${selectedBookId === b.id ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}>{b.name}</button>
          ))}
        </div>
      )}

      {/* Period Selector + Type Switch */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {viewMode === 'monthly' && (
            <>
              <button onClick={prevMonth} className="text-gray-400 p-1">&#8249;</button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {currentMonth.replace('-', '年')}月
              </span>
              <button onClick={nextMonth} className="text-gray-400 p-1">&#8250;</button>
            </>
          )}
          {viewMode === 'yearly' && (
            <>
              <button onClick={() => setCurrentYear(y => y - 1)} className="text-gray-400 p-1">&#8249;</button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{currentYear}年</span>
              <button onClick={() => setCurrentYear(y => y + 1)} className="text-gray-400 p-1">&#8250;</button>
            </>
          )}
          {viewMode === 'custom' && (
            <div className="flex items-center gap-1">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded text-xs border border-gray-200 dark:border-gray-600 w-28" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded text-xs border border-gray-200 dark:border-gray-600 w-28" />
            </div>
          )}
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
          <button
            onClick={() => setViewType('expense')}
            className={`px-3 py-1 text-xs rounded ${viewType === 'expense' ? 'bg-white dark:bg-gray-700 shadow-sm text-red-500' : 'text-gray-500'}`}
          >
            支出
          </button>
          <button
            onClick={() => setViewType('income')}
            className={`px-3 py-1 text-xs rounded ${viewType === 'income' ? 'bg-white dark:bg-gray-700 shadow-sm text-green-500' : 'text-gray-500'}`}
          >
            收入
          </button>
        </div>
      </div>

      {/* Total + Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 mb-1">总{viewType === 'expense' ? '支出' : '收入'}</p>
        <p className={`text-2xl font-bold ${viewType === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
          ¥{breakdown.total.toFixed(2)}
        </p>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-[10px] text-gray-400">日均</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">¥{overview.dailyAvg.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">笔数</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{overview.count}笔</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">最大单笔</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">¥{overview.maxSingle.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Trend Bar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 mb-3">{viewMode === 'yearly' ? '月度趋势' : '每日趋势'}</p>
        <div className="flex items-end gap-px h-20">
          {trendData.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className={`w-full rounded-t-sm ${barColors} min-h-[1px]`}
                style={{ height: `${(val / maxTrend) * 100}%` }}
                title={`${viewMode === 'yearly' ? `${i + 1}月` : `${i + 1}日`}: ¥${val.toFixed(0)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-300">1</span>
          <span className="text-[10px] text-gray-300">{trendData.length}</span>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 mb-3">分类占比</p>
        {breakdown.items.length === 0 ? (
          <p className="text-gray-300 text-sm text-center py-4">暂无数据</p>
        ) : (
          <div className="space-y-3">
            {breakdown.items.map(item => (
              <div key={item.category?.id} className="flex items-center gap-3">
                <span className="text-gray-600 dark:text-gray-300"><CategoryIcon icon={item.category?.icon || 'pin'} size={20} /></span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-200">{item.category?.name}</span>
                    <span className="text-xs text-gray-500">¥{item.amount.toFixed(0)} ({item.percent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColors}`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tag Analysis */}
      {tagBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mt-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 mb-3">标签/成员分析</p>
          <div className="space-y-2">
            {tagBreakdown.slice(0, 8).map(item => (
              <div key={item.tag} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 w-14 truncate">{item.tag}</span>
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${item.percent}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-20 text-right">¥{item.amount.toFixed(0)} ({item.percent.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Analysis */}
      {accountBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mt-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 mb-3">账户/支付方式分布</p>
          <div className="space-y-2">
            {accountBreakdown.slice(0, 6).map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-300"><CategoryIcon icon={item.account?.icon || 'debit'} size={20} /></span>
                <span className="text-xs text-gray-600 dark:text-gray-300 flex-shrink-0">{item.account?.name || '未指定'}</span>
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${item.percent}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-20 text-right">¥{item.amount.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month Comparison */}
      {viewMode === 'monthly' && monthComparison.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mt-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 mb-3">vs 上月对比</p>
          <div className="space-y-2">
            {monthComparison.slice(0, 8).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                  <span><CategoryIcon icon={item.category?.icon || 'pin'} size={14} /></span>
                  <span>{item.category?.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">¥{item.lastAmt.toFixed(0)}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-gray-700 dark:text-gray-200 font-medium">¥{item.thisAmt.toFixed(0)}</span>
                  <span className={`w-12 text-right ${item.change > 0 ? 'text-red-500' : item.change < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                    {item.change > 0 ? '↑' : item.change < 0 ? '↓' : '—'}{Math.abs(item.change).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Expenses */}
      {topExpenses.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mt-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 mb-3">Top {viewType === 'expense' ? '支出' : '收入'}</p>
          <div className="space-y-2">
            {topExpenses.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-10">{t.date.slice(5)}</span>
                  <span className="text-gray-500"><CategoryIcon icon={categoryMap.get(t.category_id!)?.icon || 'pin'} size={14} /></span>
                  <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                    {t.note || categoryMap.get(t.category_id!)?.name || '-'}
                  </span>
                </div>
                <span className={`font-medium ${viewType === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                  ¥{t.amount.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance Trend (6 months) */}
      {balanceTrend.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mt-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 mb-3">近 6 月收支结余</p>
          <div className="space-y-2">
            {balanceTrend.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-500 w-8">{m.month}</span>
                <div className="flex-1 flex items-center gap-1 mx-2">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-400 rounded-l-full" style={{ width: `${m.income / (Math.max(m.income, m.expense) || 1) * 100}%` }} />
                  </div>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex justify-end">
                    <div className="h-full bg-red-400 rounded-r-full" style={{ width: `${m.expense / (Math.max(m.income, m.expense) || 1) * 100}%` }} />
                  </div>
                </div>
                <span className={`w-16 text-right font-medium ${m.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {m.balance >= 0 ? '+' : ''}{m.balance.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-2 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full inline-block" />收入</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full inline-block" />支出</span>
          </div>
        </div>
      )}
    </main>
  )
}
