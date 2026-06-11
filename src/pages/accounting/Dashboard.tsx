import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { db, type Transaction, type Category, type Account, type Book } from '../../lib/db'
import CategoryIcon from '../../components/CategoryIcon'

const PAGE_SIZE = 30

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBookId, setSelectedBookId] = useState<number | null | 'all'>('all')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  // Search & Filter
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all')
  const [filterCategoryId, setFilterCategoryId] = useState<number | 'all'>('all')
  const [showFilter, setShowFilter] = useState(false)
  // Batch mode
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  // Inline edit modal
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', note: '', date: '', category_id: null as number | null })

  useEffect(() => {
    setPage(1)
    loadData(1)
  }, [currentMonth, selectedBookId, searchKeyword, filterType, filterCategoryId])

  async function loadData(loadPage = page) {
    const [year, month] = currentMonth.split('-').map(Number)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    let txns = await db.transactions
      .where('date')
      .between(startDate, endDate, true, false)
      .reverse()
      .sortBy('date')

    // Filter by book
    if (selectedBookId !== 'all') {
      txns = txns.filter(t => t.book_id === selectedBookId)
    }
    // Filter by type
    if (filterType !== 'all') {
      txns = txns.filter(t => t.type === filterType)
    }
    // Filter by category
    if (filterCategoryId !== 'all') {
      txns = txns.filter(t => t.category_id === filterCategoryId)
    }
    // Search keyword (note + tags)
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase()
      txns = txns.filter(t =>
        t.note.toLowerCase().includes(kw) ||
        t.tags.some(tag => tag.toLowerCase().includes(kw))
      )
    }

    // Pagination
    const total = txns.length
    const paginated = txns.slice(0, loadPage * PAGE_SIZE)
    setHasMore(total > loadPage * PAGE_SIZE)

    const cats = await db.categories.toArray()
    const accts = await db.accounts.orderBy('sort_order').filter(a => !a.is_hidden).toArray()
    const bks = await db.books.filter(b => !b.is_archived).toArray()

    setTransactions(paginated)
    setCategories(cats)
    setAccounts(accts)
    setBooks(bks)
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    loadData(next)
  }

  const summary = useMemo(() => {
    let income = 0, expense = 0
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') expense += t.amount
    }
    return { income, expense, balance: income - expense }
  }, [transactions])

  const categoryMap = useMemo(() => {
    const m = new Map<number, Category>()
    for (const c of categories) if (c.id) m.set(c.id, c)
    return m
  }, [categories])

  const accountMap = useMemo(() => {
    const m = new Map<number, Account>()
    for (const a of accounts) if (a.id) m.set(a.id, a)
    return m
  }, [accounts])

  // Group transactions by date
  const grouped = useMemo(() => {
    const groups: { date: string; items: Transaction[] }[] = []
    let currentDate = ''
    for (const t of transactions) {
      if (t.date !== currentDate) {
        currentDate = t.date
        groups.push({ date: currentDate, items: [] })
      }
      groups[groups.length - 1].items.push(t)
    }
    return groups
  }, [transactions])

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    setCurrentMonth(prev)
  }

  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    setCurrentMonth(next)
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`
  }

  async function deleteTransaction(id: number) {
    if (!confirm('确定删除这条记录？')) return
    const tx = await db.transactions.get(id)
    if (tx) {
      // Reverse balance effect
      if (tx.type === 'expense' && tx.account_id) {
        await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
      } else if (tx.type === 'income' && tx.account_id) {
        await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance -= tx.amount })
      } else if (tx.type === 'transfer') {
        if (tx.account_id) await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
        if (tx.to_account_id) await db.accounts.where('id').equals(tx.to_account_id).modify(a => { a.balance -= tx.amount })
      }
    }
    await db.transactions.delete(id)
    loadData()
  }

  // Batch delete
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function batchDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.size} 条记录？`)) return
    for (const id of selectedIds) {
      const tx = await db.transactions.get(id)
      if (tx) {
        if (tx.type === 'expense' && tx.account_id) {
          await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
        } else if (tx.type === 'income' && tx.account_id) {
          await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance -= tx.amount })
        } else if (tx.type === 'transfer') {
          if (tx.account_id) await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
          if (tx.to_account_id) await db.accounts.where('id').equals(tx.to_account_id).modify(a => { a.balance -= tx.amount })
        }
      }
    }
    await db.transactions.bulkDelete([...selectedIds])
    setSelectedIds(new Set())
    setBatchMode(false)
    loadData()
  }

  // Inline edit
  function openEditModal(t: Transaction) {
    setEditingTx(t)
    setEditForm({ amount: String(t.amount), note: t.note, date: t.date, category_id: t.category_id })
  }

  async function saveInlineEdit() {
    if (!editingTx?.id) return
    const newAmount = parseFloat(editForm.amount)
    if (!newAmount || newAmount <= 0) return
    const oldTx = editingTx
    // Reverse old balance
    if (oldTx.type === 'expense' && oldTx.account_id) {
      await db.accounts.where('id').equals(oldTx.account_id).modify(a => { a.balance += oldTx.amount })
    } else if (oldTx.type === 'income' && oldTx.account_id) {
      await db.accounts.where('id').equals(oldTx.account_id).modify(a => { a.balance -= oldTx.amount })
    } else if (oldTx.type === 'transfer') {
      if (oldTx.account_id) await db.accounts.where('id').equals(oldTx.account_id).modify(a => { a.balance += oldTx.amount })
      if (oldTx.to_account_id) await db.accounts.where('id').equals(oldTx.to_account_id).modify(a => { a.balance -= oldTx.amount })
    }
    // Apply new
    await db.transactions.update(oldTx.id!, {
      amount: newAmount,
      note: editForm.note,
      date: editForm.date,
      category_id: editForm.category_id,
      updated_at: new Date().toISOString(),
    })
    // Apply new balance
    if (oldTx.type === 'expense' && oldTx.account_id) {
      await db.accounts.where('id').equals(oldTx.account_id).modify(a => { a.balance -= newAmount })
    } else if (oldTx.type === 'income' && oldTx.account_id) {
      await db.accounts.where('id').equals(oldTx.account_id).modify(a => { a.balance += newAmount })
    } else if (oldTx.type === 'transfer') {
      if (oldTx.account_id) await db.accounts.where('id').equals(oldTx.account_id).modify(a => { a.balance -= newAmount })
      if (oldTx.to_account_id) await db.accounts.where('id').equals(oldTx.to_account_id).modify(a => { a.balance += newAmount })
    }
    setEditingTx(null)
    loadData()
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">记账本</h1>
        <div className="flex gap-2 items-center">
          <button onClick={() => setShowFilter(!showFilter)} className={`text-gray-400 hover:text-amber-500 ${showFilter ? 'text-amber-500' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
          <button onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()) }} className={`text-xs px-2 py-0.5 rounded ${batchMode ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'text-gray-400 hover:text-amber-500'}`}>
            {batchMode ? '取消' : '管理'}
          </button>
          <Link to="/accounting/stats" className="text-gray-400 hover:text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </Link>
          <Link to="/accounting/accounts" className="text-gray-400 hover:text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      {showFilter && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 mb-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2">
          <input
            type="text"
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            placeholder="搜索备注或标签..."
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600"
          />
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as typeof filterType)}
              className="flex-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs border border-gray-200 dark:border-gray-600"
            >
              <option value="all">全部类型</option>
              <option value="expense">支出</option>
              <option value="income">收入</option>
              <option value="transfer">转账</option>
            </select>
            <select
              value={filterCategoryId}
              onChange={e => setFilterCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="flex-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs border border-gray-200 dark:border-gray-600"
            >
              <option value="all">全部分类</option>
              {categories.filter(c => filterType === 'all' || c.type === filterType).map(c => (
                <option key={c.id} value={c.id!}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Month Selector + Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {currentMonth.replace('-', '年')}月
          </span>
          <button onClick={nextMonth} className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-3 text-center">
          <div>
            <p className="text-xs text-gray-400">收入</p>
            <p className="text-base font-semibold text-green-500">+{summary.income.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">支出</p>
            <p className="text-base font-semibold text-red-500">-{summary.expense.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">结余</p>
            <p className={`text-base font-semibold ${summary.balance >= 0 ? 'text-gray-700 dark:text-gray-200' : 'text-red-500'}`}>
              {summary.balance >= 0 ? '+' : ''}{summary.balance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Book Filter */}
      {books.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedBookId('all')}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${selectedBookId === 'all' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}
          >
            全部
          </button>
          <button
            onClick={() => setSelectedBookId(null)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${selectedBookId === null ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}
          >
            默认账本
          </button>
          {books.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBookId(b.id!)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${selectedBookId === b.id ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Quick Tools */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { to: '/accounting/budgets', icon: '📊', label: '预算' },
          { to: '/accounting/recurring', icon: '🔄', label: '周期' },
          { to: '/accounting/debts', icon: '🤝', label: '借还' },
          { to: '/accounting/savings', icon: '🎯', label: '攒钱' },
          { to: '/accounting/books', icon: '📚', label: '账本' },
          { to: '/accounting/categories', icon: '🏷️', label: '分类' },
          { to: '/accounting/data', icon: '📥', label: '导入导出' },
          { to: '/accounting/trend', icon: '📈', label: '趋势' },
        ].map(item => (
          <Link key={item.to} to={item.to} className="flex flex-col items-center px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 min-w-[56px] hover:border-amber-300">
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] text-gray-500 mt-0.5">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Transaction List */}
      {grouped.length === 0 ? (
        <p className="text-gray-400 text-center py-16 text-sm">本月暂无记录</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.date}>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs text-gray-400">{formatDate(group.date)}</span>
                <span className="text-xs text-gray-400">
                  {(() => {
                    let dayExp = 0, dayInc = 0
                    for (const t of group.items) {
                      if (t.type === 'expense') dayExp += t.amount
                      else if (t.type === 'income') dayInc += t.amount
                    }
                    const parts: string[] = []
                    if (dayExp > 0) parts.push(`支 ${dayExp.toFixed(0)}`)
                    if (dayInc > 0) parts.push(`收 ${dayInc.toFixed(0)}`)
                    return parts.join(' | ')
                  })()}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                {group.items.map((t, idx) => {
                  const cat = t.category_id ? categoryMap.get(t.category_id) : null
                  const acct = t.account_id ? accountMap.get(t.account_id) : null
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center px-4 py-3 ${idx > 0 ? 'border-t border-gray-50 dark:border-gray-700' : ''}`}
                    >
                      {/* Batch checkbox */}
                      {batchMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id!)}
                          onChange={() => toggleSelect(t.id!)}
                          className="mr-3 w-4 h-4 text-amber-500 rounded"
                        />
                      )}
                      <span className="mr-3 text-gray-600 dark:text-gray-300">
                        {t.type === 'transfer' ? '🔄' : <CategoryIcon icon={cat?.icon || 'pin'} size={22} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-100 truncate">
                          {t.type === 'transfer' ? '转账' : cat?.name || '未分类'}
                          {t.note && <span className="text-gray-400 ml-1">- {t.note}</span>}
                          {t.tags && t.tags.length > 0 && (
                            <span className="text-amber-500 ml-1 text-[11px]">{t.tags.map(tag => `#${tag}`).join(' ')}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">{acct?.name || ''}</span>
                          {/* Reimbursement badge */}
                          {t.reimbursement && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">报销</span>
                          )}
                          {/* Refund badge */}
                          {t.refund_for && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">退款</span>
                          )}
                          {/* Excluded badge */}
                          {t.is_excluded && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">不计</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className={`text-sm font-medium ${t.type === 'income' ? 'text-green-500' : t.type === 'expense' ? 'text-red-500' : 'text-blue-500'}`}>
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{t.amount.toFixed(2)}
                        </span>
                        {!batchMode && (
                          <>
                            <button onClick={() => openEditModal(t)} className="text-gray-300 hover:text-amber-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                            <button onClick={() => t.id && deleteTransaction(t.id)} className="text-gray-300 hover:text-red-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <button onClick={loadMore} className="w-full py-3 text-sm text-amber-500 hover:text-amber-600 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              加载更多...
            </button>
          )}
        </div>
      )}

      {/* Batch Delete Bar */}
      {batchMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center z-40">
          <button onClick={batchDelete} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-full shadow-lg">
            删除选中 ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Inline Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setEditingTx(null)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">快速编辑</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">金额</label>
                <input type="number" inputMode="decimal" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400">备注</label>
                <input type="text" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400">日期</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
              </div>
              {editingTx.type !== 'transfer' && (
                <div>
                  <label className="text-xs text-gray-400">分类</label>
                  <select value={editForm.category_id ?? ''} onChange={e => setEditForm({ ...editForm, category_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600">
                    <option value="">未分类</option>
                    {categories.filter(c => c.type === editingTx.type).map(c => (
                      <option key={c.id} value={c.id!}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingTx(null)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-xl">取消</button>
                <button onClick={saveInlineEdit} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl">保存</button>
              </div>
              <Link to={`/accounting/edit/${editingTx.id}`} className="block text-center text-xs text-gray-400 hover:text-amber-500 pt-1">
                完整编辑 →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* FAB - Add Transaction */}
      <Link
        to="/accounting/add"
        className="fixed bottom-6 right-6 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors"
      >
        +
      </Link>
    </main>
  )
}
