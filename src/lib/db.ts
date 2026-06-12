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

// ===== 储物定位器模块 =====
export interface StorageLocation {
  id?: number
  name: string
  parent_id: number | null
  icon: string
  sort_order: number
}

export interface StorageItem {
  id?: number
  name: string
  location_id: number
  quantity: number
  tags: string[]
  note: string
  created_at: string
  updated_at: string
}

// ===== 订阅管理器模块 =====
export interface Subscription {
  id?: number
  name: string
  amount: number
  currency: string // CNY/USD
  cycle: 'monthly' | 'yearly' | 'weekly'
  billing_day: number | null
  start_date: string
  next_billing_date: string
  owner: string // 我/爱人/共用
  platform: string // App Store/微信/支付宝/信用卡直扣
  pay_account_id: number | null
  category: string // 视频/音乐/工具/云服务/其他
  icon: string
  color: string
  auto_renew: boolean
  is_active: boolean
  note: string
  created_at: string
}

// ===== 相关性发现器模块 =====
export type VariableType = 'rating' | 'number' | 'boolean' | 'category'

export interface CorrelationVariable {
  id?: number
  name: string
  type: VariableType
  options?: string[] // for category type
  icon: string
  unit?: string // h, 杯, 步, etc.
  min?: number
  max?: number
  step?: number
  sort_order: number
  is_active: boolean
}

export interface CorrelationRecord {
  id?: number
  date: string
  variable_id: number
  value: number // rating:1-5, number:any, boolean:0/1, category:index
}

export interface CorrelationNote {
  id?: number
  date: string
  note: string
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

// ===== 食材库存模块 =====
export type StorageZone = 'fridge' | 'freezer' | 'pantry'
export type FoodCategory = '蔬菜' | '水果' | '肉类' | '乳制品' | '调味料' | '饮品' | '主食' | '其他'

export interface FoodItem {
  id?: number
  name: string
  icon: string
  zone: StorageZone
  category: FoodCategory
  quantity: string // "1盒", "300g", "2个"
  purchase_date: string // ISO date
  expiry_date: string // ISO date
  is_consumed: boolean
  created_at: string
  updated_at: string
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
  // 相关性发现器
  correlationVariables!: Table<CorrelationVariable>
  correlationRecords!: Table<CorrelationRecord>
  correlationNotes!: Table<CorrelationNote>
  // 订阅管理器
  subscriptions!: Table<Subscription>
  // 储物定位器
  storageLocations!: Table<StorageLocation>
  storageItems!: Table<StorageItem>
  // 食材库存
  foodItems!: Table<FoodItem>

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

    this.version(5).stores({
      correlationVariables: '++id, type, sort_order, is_active',
      correlationRecords: '++id, date, variable_id, [date+variable_id]',
      correlationNotes: '++id, &date',
    })

    this.version(6).stores({
      subscriptions: '++id, category, owner, is_active, next_billing_date',
    })

    this.version(7).stores({
      storageLocations: '++id, parent_id, sort_order',
      storageItems: '++id, location_id, *tags',
    })

    this.version(8).stores({
      foodItems: '++id, zone, category, expiry_date, is_consumed',
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

  // 默认相关性变量
  await initCorrelationVariables()
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

// ===== 初始化相关性发现器默认变量 =====
export async function initCorrelationVariables() {
  const count = await db.correlationVariables.count()
  if (count > 0) return

  const defaults: Omit<CorrelationVariable, 'id'>[] = [
    // 评分型
    { name: '情绪', type: 'rating', icon: 'smile', sort_order: 1, is_active: true },
    { name: '精力', type: 'rating', icon: 'zap', sort_order: 2, is_active: true },
    { name: '效率', type: 'rating', icon: 'target', sort_order: 3, is_active: true },
    { name: '压力', type: 'rating', icon: 'alert-triangle', sort_order: 4, is_active: true },
    { name: '睡眠质量', type: 'rating', icon: 'moon', sort_order: 5, is_active: true },
    // 数值型
    { name: '睡眠时长', type: 'number', icon: 'bed-double', unit: 'h', min: 0, max: 14, step: 0.5, sort_order: 6, is_active: true },
    { name: '午睡时长', type: 'number', icon: 'sunset', unit: 'min', min: 0, max: 120, step: 5, sort_order: 7, is_active: true },
    { name: '咖啡', type: 'number', icon: 'coffee', unit: '杯', min: 0, max: 5, step: 1, sort_order: 8, is_active: true },
    { name: '喝水', type: 'number', icon: 'droplets', unit: '杯', min: 0, max: 12, step: 1, sort_order: 9, is_active: true },
    { name: '屏幕时长', type: 'number', icon: 'smartphone', unit: 'h', min: 0, max: 16, step: 0.5, sort_order: 10, is_active: true },
    { name: '步数', type: 'number', icon: 'footprints', unit: '步', min: 0, max: 30000, step: 500, sort_order: 11, is_active: true },
    { name: '久坐时长', type: 'number', icon: 'armchair', unit: 'h', min: 0, max: 16, step: 0.5, sort_order: 12, is_active: true },
    // 布尔型
    { name: '运动', type: 'boolean', icon: 'dumbbell', sort_order: 13, is_active: true },
    { name: '喝酒', type: 'boolean', icon: 'beer', sort_order: 14, is_active: true },
    { name: '社交', type: 'boolean', icon: 'users', sort_order: 15, is_active: true },
    // 分类型
    { name: '天气', type: 'category', icon: 'cloud-sun', options: ['晴', '阴', '雨', '雪'], sort_order: 16, is_active: true },
    { name: '工作地点', type: 'category', icon: 'map-pin', options: ['公司', '家', '外出'], sort_order: 17, is_active: true },
  ]

  await db.correlationVariables.bulkAdd(defaults as CorrelationVariable[])
}
