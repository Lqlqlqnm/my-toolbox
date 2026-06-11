import Dexie, { type Table } from 'dexie'

// ===== 记账模块 =====
export interface Account {
  id?: number
  name: string
  type: 'cash' | 'debit' | 'credit' | 'ewallet'
  balance: number
  currency: string
  credit_limit?: number
  billing_day?: number
  payment_day?: number
  icon: string
  sort_order: number
  is_hidden: boolean
  created_at: string
}

export interface Category {
  id?: number
  name: string
  parent_id: number | null
  type: 'expense' | 'income'
  icon: string
  sort_order: number
}

export interface Transaction {
  id?: number
  type: 'expense' | 'income' | 'transfer'
  amount: number
  category_id: number | null
  account_id: number | null
  to_account_id: number | null
  tags: string[]
  note: string
  date: string
  book_id: number | null
  is_excluded: boolean
  is_reconciled: boolean
  is_pending: boolean // 分期未到期，余额未扣减
  currency: string
  exchange_rate: number
  reimbursement: string | null
  refund_for: number | null
  created_at: string
  updated_at: string
}

export interface Budget {
  id?: number
  category_id: number | null
  amount: number
  period: 'monthly' | 'yearly'
  book_id: number | null
}

export interface Debt {
  id?: number
  type: 'borrow' | 'lend'
  counterparty: string
  amount: number
  remaining: number
  note: string
  date: string
  due_date: string | null
  is_settled: boolean
  created_at: string
}

export interface RecurringRule {
  id?: number
  type: 'expense' | 'income'
  amount: number
  category_id: number | null
  account_id: number | null
  note: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  day_of_month: number | null
  tags: string[]
  is_active: boolean
  last_generated: string | null
}

export interface Book {
  id?: number
  name: string
  is_archived: boolean
  created_at: string
}

export interface SavingsGoal {
  id?: number
  name: string
  icon: string
  target: number
  current: number
  deadline: string | null
  created_at: string
}

// ===== ETF 模拟交易模块 =====
export interface Portfolio {
  id?: number
  name: string
  cash: number
  initial_capital: number
  created_at: string
}

export interface TradeRecord {
  id?: number
  portfolio_id: number
  code: string
  name: string
  direction: 'buy' | 'sell'
  shares: number
  price: number
  fee: number
  reason: string
  order_id: number | null
  position_id: number | null
  date: string
  created_at: string
}

export interface AnalysisRecord {
  id?: number
  articles: string[]
  market_view: string
  main_sectors: string[]
  core_logic: string
  etf_mapping: Record<string, string[]>
  orders: Array<{
    code: string
    name: string
    direction: string
    trigger_price: number
    position_pct: number
    stop_loss_pct: number
    trailing_pct: number
    activation_pct: number
    max_hold_days: number
    reason: string
  }>
  created_at: string
}

export interface PendingOrder {
  id?: number
  portfolio_id: number
  analysis_id: number | null
  code: string
  name: string
  direction: 'buy'
  trigger_price: number
  position_pct: number
  stop_loss_pct: number
  trailing_pct: number
  activation_pct: number
  max_hold_days: number
  reason: string
  status: 'pending' | 'executed' | 'cancelled'
  cancel_reason: 'superseded' | 'manual' | 'has_position' | null
  executed_price: number | null
  executed_shares: number | null
  executed_at: string | null
  created_at: string
}

export interface ActivePosition {
  id?: number
  portfolio_id: number
  order_id: number
  analysis_id: number | null
  code: string
  name: string
  buy_price: number
  shares: number
  remaining_shares: number
  highest_price: number
  buy_date: string
  stop_loss_pct: number
  trailing_pct: number
  activation_pct: number
  max_hold_days: number
  status: 'holding' | 'closed'
  close_reason: 'stop_loss' | 'trailing_stop' | 'extreme_rally' | 'max_hold' | 'manual' | null
  close_price: number | null
  close_date: string | null
  pnl: number | null
  pnl_pct: number | null
}

export interface WatchlistItem {
  id?: number
  code: string
  name: string
  reason: string
  added_at: string
}

// ===== 旅行清单模块 =====
export interface TemplateCategory {
  name: string
  icon: string
  items: string[]
}

export interface TravelTemplate {
  id?: number
  name: string
  icon: string
  categories: TemplateCategory[]
  created_at: string
}

export interface ChecklistCategory {
  name: string
  icon: string
  items: Array<{ text: string; checked: boolean }>
}

export interface TravelChecklist {
  id?: number
  template_id: number | null
  name: string
  icon: string
  categories: ChecklistCategory[]
  trip_date: string | null
  is_archived: boolean
  created_at: string
}

// ===== 数据库类 =====
class ToolboxDB extends Dexie {
  // 记账
  accounts!: Table<Account>
  categories!: Table<Category>
  transactions!: Table<Transaction>
  budgets!: Table<Budget>
  debts!: Table<Debt>
  recurring!: Table<RecurringRule>
  books!: Table<Book>
  savingsGoals!: Table<SavingsGoal>
  // ETF
  portfolios!: Table<Portfolio>
  trades!: Table<TradeRecord>
  analyses!: Table<AnalysisRecord>
  pendingOrders!: Table<PendingOrder>
  activePositions!: Table<ActivePosition>
  watchlist!: Table<WatchlistItem>
  // 旅行
  travelTemplates!: Table<TravelTemplate>
  travelChecklists!: Table<TravelChecklist>

  constructor() {
    super('my-toolbox')
    this.version(1).stores({
      // 记账
      accounts: '++id, type, sort_order',
      categories: '++id, type, parent_id, sort_order',
      transactions: '++id, type, date, category_id, account_id, book_id, is_reconciled',
      budgets: '++id, category_id, book_id',
      debts: '++id, type, is_settled',
      recurring: '++id, is_active, frequency',
      books: '++id, is_archived',
      savingsGoals: '++id',
      // ETF
      portfolios: '++id',
      trades: '++id, portfolio_id, code, date',
      analyses: '++id, created_at',
      pendingOrders: '++id, portfolio_id, status, code',
      watchlist: '++id, code',
      // 旅行
      travelTemplates: '++id',
      travelChecklists: '++id, template_id',
    })

    this.version(2).stores({
      trades: '++id, portfolio_id, code, date, order_id, position_id',
      pendingOrders: '++id, portfolio_id, analysis_id, status, code',
      activePositions: '++id, portfolio_id, order_id, code, status, buy_date',
    })

    this.version(3).stores({
      travelChecklists: '++id, template_id, is_archived',
    })

    this.version(4).stores({
      transactions: '++id, type, date, category_id, account_id, book_id, is_reconciled, is_pending',
    })
  }
}

export const db = new ToolboxDB()

// ===== 初始化默认数据 =====
export async function initDefaultData() {
  const catCount = await db.categories.count()
  if (catCount > 0) return // 已初始化

  // 默认支出分类
  const expenseCategories = [
    { name: '餐饮', icon: '🍜', type: 'expense' as const, parent_id: null, sort_order: 1 },
    { name: '交通', icon: '🚇', type: 'expense' as const, parent_id: null, sort_order: 2 },
    { name: '购物', icon: '🛒', type: 'expense' as const, parent_id: null, sort_order: 3 },
    { name: '日用', icon: '🧴', type: 'expense' as const, parent_id: null, sort_order: 4 },
    { name: '娱乐', icon: '🎬', type: 'expense' as const, parent_id: null, sort_order: 5 },
    { name: '住房', icon: '🏠', type: 'expense' as const, parent_id: null, sort_order: 6 },
    { name: '医疗', icon: '💊', type: 'expense' as const, parent_id: null, sort_order: 7 },
    { name: '教育', icon: '📚', type: 'expense' as const, parent_id: null, sort_order: 8 },
    { name: '人情', icon: '🎁', type: 'expense' as const, parent_id: null, sort_order: 9 },
    { name: '其他', icon: '📌', type: 'expense' as const, parent_id: null, sort_order: 10 },
  ]
  const incomeCategories = [
    { name: '工资', icon: '💰', type: 'income' as const, parent_id: null, sort_order: 1 },
    { name: '奖金', icon: '🏆', type: 'income' as const, parent_id: null, sort_order: 2 },
    { name: '理财', icon: '📈', type: 'income' as const, parent_id: null, sort_order: 3 },
    { name: '红包', icon: '🧧', type: 'income' as const, parent_id: null, sort_order: 4 },
    { name: '报销', icon: '📋', type: 'income' as const, parent_id: null, sort_order: 5 },
    { name: '其他', icon: '💼', type: 'income' as const, parent_id: null, sort_order: 6 },
  ]
  await db.categories.bulkAdd([...expenseCategories, ...incomeCategories])

  // 默认账户
  await db.accounts.bulkAdd([
    { name: '现金', type: 'cash', balance: 0, currency: 'CNY', icon: 'cash', sort_order: 1, is_hidden: false, created_at: new Date().toISOString() },
    { name: '微信', type: 'ewallet', balance: 0, currency: 'CNY', icon: 'wechat-pay', sort_order: 2, is_hidden: false, created_at: new Date().toISOString() },
    { name: '支付宝', type: 'ewallet', balance: 0, currency: 'CNY', icon: 'alipay', sort_order: 3, is_hidden: false, created_at: new Date().toISOString() },
  ])

  // 默认模拟仓
  await db.portfolios.add({
    name: '默认模拟仓',
    cash: 50000,
    initial_capital: 50000,
    created_at: new Date().toISOString(),
  })

  // 默认旅行模板
  await initTravelTemplates()
}

// ===== 初始化旅行模板（独立函数，可重复调用） =====
export async function initTravelTemplates() {
  const count = await db.travelTemplates.count()
  if (count > 0) return
  const { defaultTravelTemplates } = await import('./travel-templates')
  const now = new Date().toISOString()
  await db.travelTemplates.bulkAdd(
    defaultTravelTemplates.map(t => ({ ...t, created_at: now }))
  )
}

// ===== 检查到期分期，自动扣减余额 =====
export async function processPendingInstallments() {
  const today = new Date().toISOString().slice(0, 10)
  // 查找所有到期但未扣款的分期记录
  const pending = await db.transactions
    .where('is_pending').equals(1) // Dexie stores boolean as 0/1
    .filter(t => t.date <= today)
    .toArray()

  for (const tx of pending) {
    // 扣减余额
    if (tx.type === 'expense' && tx.account_id) {
      await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance -= tx.amount })
    } else if (tx.type === 'income' && tx.account_id) {
      await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance += tx.amount })
    } else if (tx.type === 'transfer') {
      if (tx.account_id) await db.accounts.where('id').equals(tx.account_id).modify(a => { a.balance -= tx.amount })
      if (tx.to_account_id) await db.accounts.where('id').equals(tx.to_account_id).modify(a => { a.balance += tx.amount })
    }
    // 标记为已扣款
    await db.transactions.update(tx.id!, { is_pending: false })
  }
  return pending.length
}

// ===== 查询待还分期汇总（按账户） =====
export async function getPendingInstallmentSummary(): Promise<Map<number, { total: number; count: number }>> {
  const pending = await db.transactions
    .where('is_pending').equals(1)
    .toArray()

  const map = new Map<number, { total: number; count: number }>()
  for (const tx of pending) {
    const accId = tx.account_id
    if (!accId) continue
    const curr = map.get(accId) || { total: 0, count: 0 }
    curr.total += tx.amount
    curr.count++
    map.set(accId, curr)
  }
  return map
}
