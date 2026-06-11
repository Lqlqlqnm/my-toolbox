import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { db, type Category, type Account, type Book, type Transaction } from '../../lib/db'
import { suggestCategory, getTemplates, addTemplate, type QuickTemplate } from '../../lib/accounting-utils'
import CategoryIcon from '../../components/CategoryIcon'
import { useModal } from '../../components/Modal'

type TxType = 'expense' | 'income' | 'transfer'

export default function AddTransaction() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showAlert } = useModal()
  const isEditing = Boolean(id)

  const [txType, setTxType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [toAccountId, setToAccountId] = useState<number | null>(null)
  const [bookId, setBookId] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [books, setBooks] = useState<Book[]>([])
  // Advanced options
  const [isExcluded, setIsExcluded] = useState(false)
  const [reimbursement, setReimbursement] = useState('')
  const [refundFor, setRefundFor] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // Installment (分期)
  const [showInstallment, setShowInstallment] = useState(false)
  const [installmentCount, setInstallmentCount] = useState('3')
  const [installmentAdjust, setInstallmentAdjust] = useState<'last' | 'first'>('last')
  const [installmentFeeRate, setInstallmentFeeRate] = useState('') // 每期费率%，如0.6
  // Transfer fee
  const [transferFee, setTransferFee] = useState('')
  // Split (拆分)
  const [showSplit, setShowSplit] = useState(false)
  const [splitItems, setSplitItems] = useState<{amount: string; note: string; category_id: number | null}[]>([])
  // Templates
  const [templates, setTemplates] = useState<QuickTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    loadOptions()
    if (id) loadTransaction(Number(id))
    setTemplates(getTemplates())
  }, [id])

  // Smart category suggestion
  const handleNoteChange = useCallback(async (val: string) => {
    setNote(val)
    if (val.length >= 2 && !isEditing && txType !== 'transfer') {
      const suggested = await suggestCategory(val, txType)
      if (suggested && !categoryId) setCategoryId(suggested)
    }
  }, [txType, isEditing, categoryId])

  async function loadOptions() {
    const cats = await db.categories.toArray()
    const accts = await db.accounts.orderBy('sort_order').filter(a => !a.is_hidden).toArray()
    const bks = await db.books.filter(b => !b.is_archived).toArray()
    setCategories(cats)
    setAccounts(accts)
    setBooks(bks)
    if (!id && accts.length > 0) setAccountId(accts[0].id!)
  }

  async function loadTransaction(txId: number) {
    const tx = await db.transactions.get(txId)
    if (!tx) return
    setTxType(tx.type)
    setAmount(String(tx.amount))
    setCategoryId(tx.category_id)
    setAccountId(tx.account_id)
    setToAccountId(tx.to_account_id)
    setBookId(tx.book_id)
    setTags(tx.tags || [])
    setNote(tx.note)
    setDate(tx.date)
    setIsExcluded(tx.is_excluded)
    setReimbursement(tx.reimbursement || '')
    setRefundFor(tx.refund_for)
  }

  function applyTemplate(tpl: QuickTemplate) {
    setTxType(tpl.type)
    setAmount(String(tpl.amount))
    setCategoryId(tpl.category_id)
    setAccountId(tpl.account_id)
    setNote(tpl.name)
    setShowTemplates(false)
  }

  const filteredCategories = categories.filter(c => c.type === txType)

  async function applyBalance(tx: { type: string; amount: number; account_id: number | null; to_account_id: number | null }, fee = 0) {
    if (tx.type === 'expense' && tx.account_id) {
      await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance -= tx.amount })
    } else if (tx.type === 'income' && tx.account_id) {
      await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
    } else if (tx.type === 'transfer') {
      if (tx.account_id) await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance -= (tx.amount + fee) })
      if (tx.to_account_id) await db.accounts.where('id').equals(tx.to_account_id).modify(a => { a.balance += tx.amount })
    }
  }

  async function reverseBalance(tx: { type: string; amount: number; account_id: number | null; to_account_id: number | null }) {
    if (tx.type === 'expense' && tx.account_id) {
      await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
    } else if (tx.type === 'income' && tx.account_id) {
      await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance -= tx.amount })
    } else if (tx.type === 'transfer') {
      if (tx.account_id) await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
      if (tx.to_account_id) await db.accounts.where('id').equals(tx.to_account_id).modify(a => { a.balance -= tx.amount })
    }
  }

  async function handleSave() {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) return

    const now = new Date().toISOString()

    // Split mode: create multiple transactions
    if (showSplit && splitItems.length > 0) {
      for (const item of splitItems) {
        const itemAmt = parseFloat(item.amount)
        if (!itemAmt || itemAmt <= 0) continue
        const txData: Omit<Transaction, 'id'> = {
          type: txType,
          amount: itemAmt,
          category_id: item.category_id,
          account_id: accountId,
          to_account_id: null,
          tags,
          note: item.note,
          date,
          book_id: bookId,
          is_excluded: isExcluded,
          is_reconciled: false,
          is_pending: false,
          currency: 'CNY',
          exchange_rate: 1,
          reimbursement: reimbursement || null,
          refund_for: null,
          created_at: now,
          updated_at: now,
        }
        await db.transactions.add(txData)
        await applyBalance(txData)
      }
      navigate('/accounting')
      return
    }

    // Installment mode: create N future transactions
    if (showInstallment) {
      const n = parseInt(installmentCount) || 1
      const feeRate = parseFloat(installmentFeeRate) || 0
      const feePerPeriod = Math.round(numAmount * feeRate / 100 * 100) / 100
      // 计算每期本金（避免精度丢失）
      const baseAmount = Math.floor(numAmount / n * 100) / 100
      const remainder = Math.round((numAmount - baseAmount * n) * 100) / 100

      for (let i = 0; i < n; i++) {
        let periodAmount = baseAmount
        // 调整差额到首期或末期
        if (installmentAdjust === 'first' && i === 0) periodAmount += remainder
        if (installmentAdjust === 'last' && i === n - 1) periodAmount += remainder
        // 加上手续费
        const totalPeriodAmount = Math.round((periodAmount + feePerPeriod) * 100) / 100

        const d = new Date(date)
        d.setMonth(d.getMonth() + i)
        const dateStr = d.toISOString().slice(0, 10)
        const feeNote = feePerPeriod > 0 ? ` (含手续费¥${feePerPeriod})` : ''
        const isFirstPeriod = i === 0
        const txData: Omit<Transaction, 'id'> = {
          type: txType,
          amount: totalPeriodAmount,
          category_id: txType === 'transfer' ? null : categoryId,
          account_id: accountId,
          to_account_id: txType === 'transfer' ? toAccountId : null,
          tags: [...tags, `分期${i + 1}/${n}`],
          note: note ? `${note} (${i + 1}/${n})${feeNote}` : `分期 ${i + 1}/${n}${feeNote}`,
          date: dateStr,
          book_id: bookId,
          is_excluded: isExcluded,
          is_reconciled: false,
          is_pending: !isFirstPeriod, // 只有首期立即扣款，后续期标记为待扣
          currency: 'CNY',
          exchange_rate: 1,
          reimbursement: reimbursement || null,
          refund_for: null,
          created_at: now,
          updated_at: now,
        }
        await db.transactions.add(txData)
        // 只有首期扣减余额
        if (isFirstPeriod) {
          await applyBalance(txData)
        }
      }
      navigate('/accounting')
      return
    }

    // Normal save
    const txData: Omit<Transaction, 'id'> = {
      type: txType,
      amount: numAmount,
      category_id: txType === 'transfer' ? null : categoryId,
      account_id: accountId,
      to_account_id: txType === 'transfer' ? toAccountId : null,
      tags,
      note,
      date,
      book_id: bookId,
      is_excluded: isExcluded,
      is_reconciled: false,
      is_pending: false,
      currency: 'CNY',
      exchange_rate: 1,
      reimbursement: reimbursement || null,
      refund_for: refundFor,
      created_at: now,
      updated_at: now,
    }

    if (isEditing) {
      const oldTx = await db.transactions.get(Number(id))
      if (oldTx) {
        await reverseBalance(oldTx)
      }
      await db.transactions.update(Number(id), { ...txData, updated_at: now })
    } else {
      await db.transactions.add(txData)
      // 如果有转账手续费，额外记录一笔支出
      const feeAmount = txType === 'transfer' ? (parseFloat(transferFee) || 0) : 0
      if (feeAmount > 0) {
        await db.transactions.add({
          type: 'expense',
          amount: feeAmount,
          category_id: null,
          account_id: accountId,
          to_account_id: null,
          tags: ['手续费'],
          note: `转账手续费 (${note || '转账'})`,
          date,
          book_id: bookId,
          is_excluded: false,
          is_reconciled: false,
          is_pending: false,
          currency: 'CNY',
          exchange_rate: 1,
          reimbursement: null,
          refund_for: null,
          created_at: now,
          updated_at: now,
        })
      }
    }

    const feeAmount = txType === 'transfer' ? (parseFloat(transferFee) || 0) : 0
    await applyBalance(txData, feeAmount)
    navigate('/accounting')
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {isEditing ? '编辑记录' : '记一笔'}
        </h1>
        <button onClick={() => setShowTemplates(!showTemplates)} className="text-gray-400 hover:text-amber-500 text-xs">
          模板
        </button>
      </div>

      {/* Quick Templates */}
      {showTemplates && templates.length > 0 && (
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 mb-2">快捷模板</p>
          <div className="flex flex-wrap gap-2">
            {templates.map(tpl => (
              <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                className="px-3 py-1.5 rounded-full text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                {tpl.name} ¥{tpl.amount}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Type Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
        {(['expense', 'income', 'transfer'] as TxType[]).map(t => (
          <button
            key={t}
            onClick={() => { setTxType(t); setCategoryId(null) }}
            className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
              txType === t
                ? t === 'expense' ? 'bg-red-500 text-white'
                  : t === 'income' ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white'
                : 'text-gray-500'
            }`}
          >
            {t === 'expense' ? '支出' : t === 'income' ? '收入' : '转账'}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="mb-6">
        <div className="flex items-center justify-center">
          <span className="text-2xl text-gray-400 mr-1">¥</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="text-4xl font-bold text-center text-gray-800 dark:text-gray-100 bg-transparent outline-none w-48"
            autoFocus
          />
        </div>
      </div>

      {/* Category Grid (not for transfer) */}
      {txType !== 'transfer' && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-2">分类</p>
          <div className="grid grid-cols-5 gap-2">
            {filteredCategories.map(c => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id!)}
                className={`flex flex-col items-center py-2 rounded-lg text-xs transition-colors ${
                  categoryId === c.id
                    ? 'bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-400'
                    : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="mb-0.5 text-gray-600 dark:text-gray-300"><CategoryIcon icon={c.icon} size={20} /></span>
                <span className="text-gray-600 dark:text-gray-300">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Account */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">{txType === 'transfer' ? '转出账户' : '账户'}</p>
        <div className="flex flex-wrap gap-2">
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => setAccountId(a.id!)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                accountId === a.id
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              <span className="inline-flex items-center gap-1"><CategoryIcon icon={a.icon} size={14} /> {a.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* To Account (transfer only) */}
      {txType === 'transfer' && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">转入账户</p>
          <div className="flex flex-wrap gap-2">
            {accounts.filter(a => a.id !== accountId).map(a => (
              <button
                key={a.id}
                onClick={() => setToAccountId(a.id!)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  toAccountId === a.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span className="inline-flex items-center gap-1"><CategoryIcon icon={a.icon} size={14} /> {a.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">手续费:</span>
            <input type="number" value={transferFee} onChange={e => setTransferFee(e.target.value)}
              placeholder="0" step="0.01"
              className="w-20 px-2 py-1 bg-white dark:bg-gray-700 rounded text-sm border border-gray-200 dark:border-gray-600" />
            <span className="text-xs text-gray-400">(可选，从转出账户扣除)</span>
          </div>
        </div>
      )}

      {/* Date */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">日期</p>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
        />
      </div>

      {/* Note */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">备注</p>
        <input
          type="text"
          value={note}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder="输入备注自动推荐分类"
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
        />
      </div>

      {/* Tags */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">标签</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs">
              #{tag}
              <button onClick={() => setTags(tags.filter((_, idx) => idx !== i))} className="text-amber-400 hover:text-red-500">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && tagInput.trim()) {
                e.preventDefault()
                if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()])
                setTagInput('')
              }
            }}
            placeholder="输入后回车添加"
            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
          />
          <button
            type="button"
            onClick={() => { if (tagInput.trim() && !tags.includes(tagInput.trim())) { setTags([...tags, tagInput.trim()]); setTagInput('') } }}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs text-gray-500"
          >
            添加
          </button>
        </div>
      </div>

      {/* Book */}
      {books.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">账本</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBookId(null)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${bookId === null ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
            >
              默认
            </button>
            {books.map(b => (
              <button
                key={b.id}
                onClick={() => setBookId(b.id!)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${bookId === b.id ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Options Toggle */}
      <div className="mb-4">
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-gray-400 hover:text-amber-500">
          {showAdvanced ? '收起高级选项 ▲' : '高级选项 ▼'}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-4 mb-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          {/* Exclude from stats */}
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">排除统计</span>
            <input type="checkbox" checked={isExcluded} onChange={e => setIsExcluded(e.target.checked)}
              className="w-4 h-4 text-amber-500 rounded" />
          </label>

          {/* Reimbursement mark */}
          <div>
            <label className="text-xs text-gray-400">报销标记</label>
            <input type="text" value={reimbursement} onChange={e => setReimbursement(e.target.value)}
              placeholder="如：公司报销、差旅"
              className="w-full mt-1 px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
          </div>

          {/* Installment */}
          {!isEditing && (
            <div>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">分期记账</span>
                <input type="checkbox" checked={showInstallment} onChange={e => { setShowInstallment(e.target.checked); if (e.target.checked) setShowSplit(false) }}
                  className="w-4 h-4 text-amber-500 rounded" />
              </label>
              {showInstallment && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">分</span>
                    <input type="number" value={installmentCount} onChange={e => setInstallmentCount(e.target.value)}
                      className="w-16 px-2 py-1 bg-white dark:bg-gray-700 rounded text-sm border border-gray-200 dark:border-gray-600 text-center" min="2" max="60" />
                    <span className="text-xs text-gray-500">期，每期 ¥{amount ? (Math.floor(parseFloat(amount) / (parseInt(installmentCount) || 1) * 100) / 100).toFixed(2) : '0.00'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">调整:</span>
                    <button onClick={() => setInstallmentAdjust('last')}
                      className={`px-2 py-0.5 text-xs rounded ${installmentAdjust === 'last' ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>末期</button>
                    <button onClick={() => setInstallmentAdjust('first')}
                      className={`px-2 py-0.5 text-xs rounded ${installmentAdjust === 'first' ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>首期</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">手续费率:</span>
                    <input type="number" value={installmentFeeRate} onChange={e => setInstallmentFeeRate(e.target.value)}
                      placeholder="0" step="0.1"
                      className="w-16 px-2 py-1 bg-white dark:bg-gray-700 rounded text-sm border border-gray-200 dark:border-gray-600 text-center" />
                    <span className="text-xs text-gray-500">%/期 {installmentFeeRate && amount ? `(每期+¥${(parseFloat(amount) * parseFloat(installmentFeeRate) / 100).toFixed(2)})` : '(可选)'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Split */}
          {!isEditing && txType !== 'transfer' && (
            <div>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">拆分记账</span>
                <input type="checkbox" checked={showSplit} onChange={e => { setShowSplit(e.target.checked); if (e.target.checked) { setShowInstallment(false); setSplitItems([{amount: '', note: '', category_id: categoryId}, {amount: '', note: '', category_id: null}]) } }}
                  className="w-4 h-4 text-amber-500 rounded" />
              </label>
              {showSplit && (
                <div className="mt-2 space-y-2">
                  {splitItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="number" value={item.amount} onChange={e => { const n = [...splitItems]; n[idx].amount = e.target.value; setSplitItems(n) }}
                        placeholder="金额" className="w-20 px-2 py-1 bg-white dark:bg-gray-700 rounded text-sm border border-gray-200 dark:border-gray-600" />
                      <input type="text" value={item.note} onChange={e => { const n = [...splitItems]; n[idx].note = e.target.value; setSplitItems(n) }}
                        placeholder="备注" className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 rounded text-sm border border-gray-200 dark:border-gray-600" />
                      {splitItems.length > 2 && (
                        <button onClick={() => setSplitItems(splitItems.filter((_, i) => i !== idx))} className="text-red-400 text-xs">删</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setSplitItems([...splitItems, {amount: '', note: '', category_id: null}])}
                    className="text-xs text-amber-500">+ 添加一项</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!amount || parseFloat(amount) <= 0}
        className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:dark:bg-gray-700 text-white font-medium rounded-xl transition-colors"
      >
        {isEditing ? '保存修改' : showInstallment ? `保存 (${installmentCount}期)` : showSplit ? `保存 (${splitItems.length}笔)` : '保存'}
      </button>

      {/* Save as Template */}
      {!isEditing && amount && parseFloat(amount) > 0 && note && (
        <button
          onClick={() => {
            addTemplate({ name: note, type: txType, amount: parseFloat(amount), category_id: categoryId, account_id: accountId, note })
            setTemplates(getTemplates())
            showAlert('已保存为模板')
          }}
          className="w-full mt-2 py-2 text-sm text-amber-600 border border-amber-200 dark:border-amber-800 rounded-xl"
        >
          保存为模板
        </button>
      )}
    </main>
  )
}
