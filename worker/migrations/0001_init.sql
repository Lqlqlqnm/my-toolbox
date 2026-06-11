-- 模拟仓
CREATE TABLE IF NOT EXISTS portfolios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cash REAL NOT NULL DEFAULT 50000,
  initial_capital REAL NOT NULL DEFAULT 50000,
  created_at TEXT NOT NULL
);

-- 分析记录
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  articles TEXT NOT NULL, -- JSON array
  market_view TEXT NOT NULL,
  main_sectors TEXT NOT NULL, -- JSON array
  core_logic TEXT NOT NULL,
  etf_mapping TEXT NOT NULL, -- JSON object
  orders TEXT NOT NULL, -- JSON array
  created_at TEXT NOT NULL
);

-- 条件单
CREATE TABLE IF NOT EXISTS pending_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL,
  analysis_id INTEGER,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'buy',
  trigger_price REAL NOT NULL,
  position_pct REAL NOT NULL,
  stop_loss_pct REAL NOT NULL DEFAULT 5,
  trailing_pct REAL NOT NULL DEFAULT 3,
  activation_pct REAL NOT NULL DEFAULT 8,
  max_hold_days INTEGER NOT NULL DEFAULT 15,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending/executed/cancelled
  cancel_reason TEXT, -- superseded/manual/has_position
  executed_price REAL,
  executed_shares INTEGER,
  executed_at TEXT,
  created_at TEXT NOT NULL
);

-- 活跃持仓
CREATE TABLE IF NOT EXISTS active_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  analysis_id INTEGER,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  buy_price REAL NOT NULL,
  shares INTEGER NOT NULL,
  remaining_shares INTEGER NOT NULL,
  highest_price REAL NOT NULL,
  buy_date TEXT NOT NULL,
  stop_loss_pct REAL NOT NULL,
  trailing_pct REAL NOT NULL,
  activation_pct REAL NOT NULL,
  max_hold_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'holding', -- holding/closed
  close_reason TEXT, -- stop_loss/trailing_stop/extreme_rally/max_hold/manual
  close_price REAL,
  close_date TEXT,
  pnl REAL,
  pnl_pct REAL
);

-- 交易记录
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL, -- buy/sell
  shares INTEGER NOT NULL,
  price REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  order_id INTEGER,
  position_id INTEGER,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 自选列表
CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL
);

-- 通知记录
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- order_created/buy_executed/sell_executed
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_orders_status ON pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_code ON pending_orders(code);
CREATE INDEX IF NOT EXISTS idx_positions_status ON active_positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_code ON active_positions(code);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- 初始化默认模拟仓
INSERT INTO portfolios (name, cash, initial_capital, created_at)
SELECT '默认模拟仓', 50000, 50000, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM portfolios);
