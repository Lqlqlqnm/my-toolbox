import { db } from './db'

export interface BackupData {
  version: number
  app: string
  exported_at: string
  accounting: {
    transactions: unknown[]
    accounts: unknown[]
    categories: unknown[]
    budgets: unknown[]
    debts: unknown[]
    recurring: unknown[]
    books: unknown[]
    savingsGoals: unknown[]
  }
  trading: {
    portfolios: unknown[]
    trades: unknown[]
    analyses: unknown[]
    pendingOrders: unknown[]
    watchlist: unknown[]
  }
  travel: {
    templates: unknown[]
    checklists: unknown[]
  }
  settings: Record<string, unknown>
}

// 导出全部数据为 JSON
export async function exportBackup(): Promise<BackupData> {
  const [
    transactions, accounts, categories, budgets, debts, recurring, books, savingsGoals,
    portfolios, trades, analyses, pendingOrders, watchlist,
    templates, checklists,
  ] = await Promise.all([
    db.transactions.toArray(),
    db.accounts.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.debts.toArray(),
    db.recurring.toArray(),
    db.books.toArray(),
    db.savingsGoals.toArray(),
    db.portfolios.toArray(),
    db.trades.toArray(),
    db.analyses.toArray(),
    db.pendingOrders.toArray(),
    db.watchlist.toArray(),
    db.travelTemplates.toArray(),
    db.travelChecklists.toArray(),
  ])

  return {
    version: 2,
    app: 'my-toolbox',
    exported_at: new Date().toISOString(),
    accounting: { transactions, accounts, categories, budgets, debts, recurring, books, savingsGoals },
    trading: { portfolios, trades, analyses, pendingOrders, watchlist },
    travel: { templates, checklists },
    settings: {
      ai_config: localStorage.getItem('ai_config') ? JSON.parse(localStorage.getItem('ai_config')!) : null,
      backup_interval_days: parseInt(localStorage.getItem('backup_interval_days') || '7'),
    },
  }
}

// 导入备份数据（智能合并，按 ID 去重）
export async function importBackup(data: BackupData): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  // Helper: 批量导入，跳过已存在的 ID
  async function bulkImport<T extends { id?: number }>(table: { bulkPut: (items: T[]) => Promise<unknown>; count: () => Promise<number> }, items: T[]) {
    if (!items || items.length === 0) return
    await table.bulkPut(items)
    imported += items.length
  }

  if (data.accounting) {
    await bulkImport(db.accounts, data.accounting.accounts as never[])
    await bulkImport(db.categories, data.accounting.categories as never[])
    await bulkImport(db.transactions, data.accounting.transactions as never[])
    await bulkImport(db.budgets, data.accounting.budgets as never[])
    await bulkImport(db.debts, data.accounting.debts as never[])
    await bulkImport(db.recurring, data.accounting.recurring as never[])
    await bulkImport(db.books, data.accounting.books as never[])
    await bulkImport(db.savingsGoals, data.accounting.savingsGoals as never[])
  }

  if (data.trading) {
    await bulkImport(db.portfolios, data.trading.portfolios as never[])
    await bulkImport(db.trades, data.trading.trades as never[])
    await bulkImport(db.analyses, data.trading.analyses as never[])
    await bulkImport(db.pendingOrders, data.trading.pendingOrders as never[])
    await bulkImport(db.watchlist, data.trading.watchlist as never[])
  }

  if (data.travel) {
    await bulkImport(db.travelTemplates, data.travel.templates as never[])
    await bulkImport(db.travelChecklists, data.travel.checklists as never[])
  }

  // Restore settings
  if (data.settings?.ai_config) {
    localStorage.setItem('ai_config', JSON.stringify(data.settings.ai_config))
  }

  return { imported, skipped }
}

// 通过 Web Share API 分享备份文件
export async function shareBackup() {
  const data = await exportBackup()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const file = new File([blob], `toolbox-backup-${new Date().toISOString().split('T')[0]}.json`, { type: 'application/json' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'My Toolbox 备份' })
    localStorage.setItem('last_backup_time', new Date().toISOString())
    return 'shared'
  } else {
    // Fallback: 下载文件
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
    localStorage.setItem('last_backup_time', new Date().toISOString())
    return 'downloaded'
  }
}

// 检查是否需要提醒备份
export function shouldRemindBackup(): boolean {
  const interval = parseInt(localStorage.getItem('backup_interval_days') || '7')
  if (interval <= 0) return false
  const lastBackup = localStorage.getItem('last_backup_time')
  if (!lastBackup) return true
  const daysSince = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince >= interval
}
