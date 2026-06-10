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
  positions: Array<{ code: string; name: string; shares: number; cost: number; sector: string }>
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
  date: string
  created_at: string
}

export interface AnalysisRecord {
  id?: number
  articles: string[] // 多篇文章原文
  market_view: string
  main_sectors: string[]
  core_logic: string
  etf_mapping: Record<string, string[]>
  orders: Array<{ code: string; name: string; direction: string; trigger_price: number; position_pct: number }>
  created_at: string
}

export interface PendingOrder {
  id?: number
  portfolio_id: number
  analysis_id: number | null
  code: string
  name: string
  direction: 'buy' | 'sell'
  trigger_price: number
  shares: number
  status: 'pending' | 'triggered' | 'cancelled'
  created_at: string
}

export interface WatchlistItem {
  id?: number
  code: string
  name: string
  reason: string
  added_at: string
}

// ===== 旅行清单模块 =====
export interface TravelTemplate {
  id?: number
  name: string
  icon: string
  items: string[]
  created_at: string
}

export interface TravelChecklist {
  id?: number
  template_id: number | null
  name: string
  icon: string
  items: Array<{ text: string; checked: boolean }>
  trip_date: string | null
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
    { name: '其他', icon: '📌', type: 'income' as const, parent_id: null, sort_order: 6 },
  ]
  await db.categories.bulkAdd([...expenseCategories, ...incomeCategories])

  // 默认账户
  await db.accounts.bulkAdd([
    { name: '现金', type: 'cash', balance: 0, currency: 'CNY', icon: '💵', sort_order: 1, is_hidden: false, created_at: new Date().toISOString() },
    { name: '微信', type: 'ewallet', balance: 0, currency: 'CNY', icon: '💬', sort_order: 2, is_hidden: false, created_at: new Date().toISOString() },
    { name: '支付宝', type: 'ewallet', balance: 0, currency: 'CNY', icon: '🔵', sort_order: 3, is_hidden: false, created_at: new Date().toISOString() },
  ])

  // 默认模拟仓
  await db.portfolios.add({
    name: '默认模拟仓',
    cash: 50000,
    initial_capital: 50000,
    positions: [],
    created_at: new Date().toISOString(),
  })
}
