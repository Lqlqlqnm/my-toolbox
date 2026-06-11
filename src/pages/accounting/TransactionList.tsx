import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Calendar as CalendarIcon, X } from 'lucide-react'
import { db, type Transaction, type Category, type Account } from '../../lib/db'
import CategoryIcon from '../../components/CategoryIcon'

const PAGE_SIZE = 30

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  // Undo delete
  const [pendingDelete, setPendingDelete] = useState<{ id: number; timer: ReturnType<typeof setTimeout> } | null>(null)

  useEffect(() => { setPage(1); loadData(1) }, [currentMonth, searchKeyword, filterType, selectedDate])

  async function loadData(loadPage = page) {
    const [year, month] = currentMonth.split('-').map(Number)
    const startDate = selectedDate || `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = selectedDate
      ? `${selectedDate}T23:59:59`
      : month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

    let txns: Transaction[]
    if (selectedDate) {
      txns = await db.transactions.where('date').equals(selectedDate).reverse().sortBy('date')
    } else {
      txns = await db.transactions.where('date').between(startDate, endDate, true, false).reverse().sortBy('date')
    }

    if (filterType !== 'all') txns = txns.filter(t => t.type === filterType)
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase()
      txns = txns.filter(t => t.note.toLowerCase().includes(kw) || t.tags.some(tag => tag.toLowerCase().includes(kw)))
    }

    const paginated = txns.slice(0, loadPage * PAGE_SIZE)
    setHasMore(txns.length > loadPage * PAGE_SIZE)
    setTransactions(paginated)

    const [cats, accts] = await Promise.all([
      db.categories.toArray(),
      db.accounts.orderBy('sort_order').filter(a => !a.is_hidden).toArray(),
    ])
    setCategories(cats)
    setAccounts(accts)
  }

  const summary = useMemo(() => {
    let income = 0, expense = 0
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') expense += t.amount
    }
    return { income, expense, balance: income - expense }
  }, [transactions])

  const categoryMap = useMemo(() => { const m = new Map<number, Category>(); categories.forEach(c => { if (c.id) m.set(c.id, c) }); return m }, [categories])
  const accountMap = useMemo(() => { const m = new Map<number, Account>(); accounts.forEach(a => { if (a.id) m.set(a.id, a) }); return m }, [accounts])

  const grouped = useMemo(() => {
    const groups: { date: string; items: Transaction[] }[] = []
    let curDate = ''
    for (const t of transactions) {
      if (t.date !== curDate) { curDate = t.date; groups.push({ date: curDate, items: [] }) }
      groups[groups.length - 1].items.push(t)
    }
    return groups
  }, [transactions])

  // Calendar data: which days have records
  const daysWithRecords = useMemo(() => {
    const days = new Set<number>()
    transactions.forEach(t => { const d = parseInt(t.date.split('-')[2]); days.add(d) })
    return days
  }, [transactions])

  function prevMonth() { const [y, m] = currentMonth.split('-').map(Number); setCurrentMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`); setSelectedDate(null) }
  function nextMonth() { const [y, m] = currentMonth.split('-').map(Number); setCurrentMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`); setSelectedDate(null) }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`
  }

  async function deleteTransaction(id: number) {
    if (!confirm('确定删除此记录？删除后账户余额将自动回滚。')) return
    const tx = await db.transactions.get(id)
    if (!tx) return
    // Remove from UI immediately
    setTransactions(prev => prev.filter(t => t.id !== id))
    // Set undo timer (5s grace period before actual deletion)
    const timer = setTimeout(async () => {
      // Reverse balance
      if (tx.type === 'expense' && tx.account_id) {
        await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
      } else if (tx.type === 'income' && tx.account_id) {
        await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance -= tx.amount })
      } else if (tx.type === 'transfer') {
        if (tx.account_id) await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
        if (tx.to_account_id) await db.accounts.where('id').equals(tx.to_account_id).modify(a => { a.balance -= tx.amount })
      }
      await db.transactions.delete(id)
      setPendingDelete(null)
    }, 5000)
    setPendingDelete({ id, timer })
  }

  async function refundTransaction(tx: Transaction) {
    if (!tx.id) return
    const refundAmount = prompt(`退款金额（原金额 ¥${tx.amount}）`, String(tx.amount))
    if (!refundAmount) return
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) return
    const now = new Date().toISOString()
    const refundTx = {
      type: 'income' as const,
      amount,
      category_id: tx.category_id,
      account_id: tx.account_id,
      to_account_id: null,
      tags: [...(tx.tags || []), '退款'],
      note: `退款: ${tx.note || ''}`.trim(),
      date: new Date().toISOString().slice(0, 10),
      book_id: tx.book_id,
      is_excluded: false,
      is_reconciled: false,
      currency: tx.currency,
      exchange_rate: 1,
      reimbursement: null,
      refund_for: tx.id,
      created_at: now,
      updated_at: now,
    }
    await db.transactions.add(refundTx)
    if (tx.account_id) {
      await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += amount })
    }
    await loadData()
  }

  function undoDelete() {
    if (pendingDelete) { clearTimeout(pendingDelete.timer); setPendingDelete(null); loadData() }
  }

  // Calendar rendering
  function renderCalendar() {
    const [year, month] = currentMonth.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = new Date()
    const todayDate = today.getDate()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(<span key={`e${i}`} />)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const hasRecord = daysWithRecords.has(d)
      const isSelected = selectedDate === dateStr
      const isToday = isCurrentMonth && d === todayDate
      cells.push(
        <button
          key={d}
          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
          className={`w-8 h-8 flex items-center justify-center mx-auto text-xs relative rounded-full transition-colors
            ${isSelected ? 'bg-amber-500 text-white font-bold' : isToday ? 'border border-amber-400 text-amber-600' : d > todayDate && isCurrentMonth ? 'text-gray-300' : 'text-gray-700 dark:text-gray-200'}
          `}
        >
          {d}
          {hasRecord && !isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-400 rounded-full" />}
        </button>
      )
    }
    return cells
  }

  return (
    <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
      {/* Month + Controls */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-gray-400 px-2">&lt;</button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{currentMonth.replace('-', '年')}月</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCalendar(!showCalendar)} className={`p-1.5 rounded-lg transition-colors ${showCalendar ? 'bg-amber-500 text-white' : 'text-gray-400 hover:bg-gray-100'}`}>
            <CalendarIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setShowFilter(!showFilter)} className={`p-1.5 rounded-lg transition-colors ${showFilter ? 'bg-amber-500 text-white' : 'text-gray-400 hover:bg-gray-100'}`}>
            <Search className="w-4 h-4" />
          </button>
          <button onClick={nextMonth} className="text-gray-400 px-2">&gt;</button>
        </div>
      </div>

      {/* Calendar View */}
      {showCalendar && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 mb-4">
          <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-2">
            {['日','一','二','三','四','五','六'].map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">{renderCalendar()}</div>
          {selectedDate && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-500">{formatDate(selectedDate)}</span>
              <button onClick={() => setSelectedDate(null)} className="text-xs text-amber-500 flex items-center gap-1"><X className="w-3 h-3" />清除筛选</button>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      {showFilter && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 mb-4 space-y-2">
          <input type="text" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="搜索备注或标签..." className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
          <div className="flex gap-2">
            {(['all','expense','income','transfer'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1 rounded-full text-xs ${filterType === t ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                {t === 'all' ? '全部' : t === 'expense' ? '支出' : t === 'income' ? '收入' : '转账'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 text-center py-3 bg-white dark:bg-gray-800 rounded-xl mb-4 border border-gray-100 dark:border-gray-700">
        <div><p className="text-xs text-gray-400">收入</p><p className="text-sm font-semibold text-green-500">+{summary.income.toFixed(2)}</p></div>
        <div><p className="text-xs text-gray-400">支出</p><p className="text-sm font-semibold text-red-500">-{summary.expense.toFixed(2)}</p></div>
        <div><p className="text-xs text-gray-400">结余</p><p className={`text-sm font-semibold ${summary.balance >= 0 ? 'text-gray-700 dark:text-gray-200' : 'text-red-500'}`}>{summary.balance.toFixed(2)}</p></div>
      </div>

      {/* Transaction List */}
      {grouped.length === 0 ? (
        <p className="text-gray-400 text-center py-16 text-sm">{selectedDate ? '当日无记录' : '本月暂无记录'}</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.date}>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs text-gray-400">{formatDate(group.date)}</span>
                <span className="text-xs text-gray-400">
                  {(() => { let e = 0, i = 0; group.items.forEach(t => { if (t.type === 'expense') e += t.amount; else if (t.type === 'income') i += t.amount }); const p: string[] = []; if (e) p.push(`支 ${e.toFixed(0)}`); if (i) p.push(`收 ${i.toFixed(0)}`); return p.join(' | ') })()}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                {group.items.map((t, idx) => {
                  const cat = t.category_id ? categoryMap.get(t.category_id) : null
                  const acct = t.account_id ? accountMap.get(t.account_id) : null
                  return (
                    <div key={t.id} className={`flex items-center px-4 py-3 ${idx > 0 ? 'border-t border-gray-50 dark:border-gray-700' : ''}`}>
                      <span className="text-gray-600 dark:text-gray-300 mr-3">{t.type === 'transfer' ? '🔄' : <CategoryIcon icon={cat?.icon || 'pin'} size={22} />}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-100 truncate">
                          {t.type === 'transfer' ? '转账' : cat?.name || '未分类'}
                          {t.note && <span className="text-gray-400 ml-1">- {t.note}</span>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-gray-400">{acct?.name || ''}</span>
                          {t.tags?.length > 0 && t.tags.map(tag => <span key={tag} className="text-[10px] px-1 bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400 rounded">{`#${tag}`}</span>)}
                          {t.reimbursement && <span className="text-[10px] px-1 bg-orange-50 text-orange-500 rounded">{t.reimbursement === 'pending' ? '待报销' : '已报销'}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-medium ${t.type === 'income' ? 'text-green-500' : t.type === 'expense' ? 'text-red-500' : 'text-blue-500'}`}>
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{t.amount.toFixed(2)}
                        </span>
                        {t.type === 'expense' && (
                          <button onClick={() => refundTransaction(t)} className="text-gray-300 hover:text-green-500 ml-1" title="退款">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                        <button onClick={() => t.id && deleteTransaction(t.id)} className="text-gray-300 hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {hasMore && (
            <button onClick={() => { const next = page + 1; setPage(next); loadData(next) }} className="w-full py-3 text-sm text-amber-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              加载更多...
            </button>
          )}
        </div>
      )}

      {/* Undo Toast */}
      {pendingDelete && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 z-50 text-sm">
          <span>已删除</span>
          <button onClick={undoDelete} className="text-amber-400 font-medium">撤销</button>
          <span className="text-gray-400 text-xs">5秒后生效</span>
        </div>
      )}
    </main>
  )
}