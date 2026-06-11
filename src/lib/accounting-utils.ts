import { db, type Transaction, type Category } from './db'

// ===== Smart Category Suggestion =====
export async function suggestCategory(note: string, type: 'expense' | 'income'): Promise<number | null> {
  if (!note || note.length < 2) return null
  const all = await db.transactions
    .where('type').equals(type)
    .filter(t => t.category_id !== null && t.note.includes(note))
    .limit(10)
    .toArray()
  if (all.length === 0) return null
  // Count category frequency
  const freq = new Map<number, number>()
  for (const t of all) {
    if (t.category_id) freq.set(t.category_id, (freq.get(t.category_id) || 0) + 1)
  }
  let best: number | null = null, bestCount = 0
  for (const [catId, count] of freq) {
    if (count > bestCount) { best = catId; bestCount = count }
  }
  return best
}

// ===== Quick Templates =====
export interface QuickTemplate {
  id: string
  name: string
  type: 'expense' | 'income'
  amount: number
  category_id: number | null
  account_id: number | null
  note: string
}

export function getTemplates(): QuickTemplate[] {
  const saved = localStorage.getItem('accounting_templates')
  return saved ? JSON.parse(saved) : []
}

export function saveTemplates(templates: QuickTemplate[]) {
  localStorage.setItem('accounting_templates', JSON.stringify(templates))
}

export function addTemplate(tpl: Omit<QuickTemplate, 'id'>) {
  const templates = getTemplates()
  templates.push({ ...tpl, id: Date.now().toString(36) })
  saveTemplates(templates)
}

export function deleteTemplate(id: string) {
  saveTemplates(getTemplates().filter(t => t.id !== id))
}

// ===== CSV Export =====
export async function exportCSV(startDate: string, endDate: string): Promise<string> {
  const txns = await db.transactions
    .where('date')
    .between(startDate, endDate, true, false)
    .toArray()
  const cats = await db.categories.toArray()
  const accts = await db.accounts.toArray()
  const catMap = new Map(cats.map(c => [c.id!, c]))
  const acctMap = new Map(accts.map(a => [a.id!, a]))

  const header = '日期,类型,金额,分类,账户,备注,标签'
  const rows = txns.map(t => {
    const cat = t.category_id ? catMap.get(t.category_id) : null
    const acct = t.account_id ? acctMap.get(t.account_id) : null
    const typeLabel = t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账'
    return [
      t.date,
      typeLabel,
      t.amount.toFixed(2),
      cat?.name || '',
      acct?.name || '',
      `"${t.note.replace(/"/g, '""')}"`,
      t.tags.join(';'),
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

// ===== CSV Import (WeChat / Alipay) =====
interface ParsedRow {
  date: string
  type: 'expense' | 'income'
  amount: number
  note: string
  category_name: string
}

export function parseWeChatCSV(content: string): ParsedRow[] {
  const lines = content.split('\n').filter(l => l.trim())
  // WeChat CSV: 交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
  const headerIdx = lines.findIndex(l => l.includes('交易时间') && l.includes('金额'))
  if (headerIdx === -1) return []
  const rows: ParsedRow[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(s => s.replace(/"/g, '').trim())
    if (cols.length < 6) continue
    const dateStr = cols[0].slice(0, 10) // YYYY-MM-DD or YYYY/MM/DD
    const date = dateStr.replace(/\//g, '-')
    const direction = cols[4] // 收/支
    const amountStr = cols[5].replace(/[¥￥]/g, '')
    const amount = parseFloat(amountStr)
    if (!amount || amount <= 0) continue
    const type = direction === '收入' ? 'income' : 'expense'
    const note = cols[3] || cols[2] || ''
    rows.push({ date, type, amount, note, category_name: '' })
  }
  return rows
}

export function parseAlipayCSV(content: string): ParsedRow[] {
  const lines = content.split('\n').filter(l => l.trim())
  // Alipay CSV: 交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
  const headerIdx = lines.findIndex(l => l.includes('交易时间') && l.includes('交易分类'))
  if (headerIdx === -1) {
    // Try alternative format
    const altIdx = lines.findIndex(l => l.includes('交易创建时间'))
    if (altIdx === -1) return []
    return parseAlipayAlt(lines, altIdx)
  }
  const rows: ParsedRow[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(s => s.replace(/"/g, '').trim())
    if (cols.length < 6) continue
    const dateStr = cols[0].slice(0, 10)
    const date = dateStr.replace(/\//g, '-')
    const direction = cols[4]
    const amountStr = cols[5].replace(/[¥￥]/g, '')
    const amount = parseFloat(amountStr)
    if (!amount || amount <= 0) continue
    const type = direction === '收入' ? 'income' : 'expense'
    const note = cols[3] || cols[2] || ''
    const category_name = cols[1] || ''
    rows.push({ date, type, amount, note, category_name })
  }
  return rows
}

function parseAlipayAlt(lines: string[], headerIdx: number): ParsedRow[] {
  const rows: ParsedRow[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(s => s.replace(/"/g, '').trim())
    if (cols.length < 6) continue
    const dateStr = cols[0].slice(0, 10)
    const date = dateStr.replace(/\//g, '-')
    const amount = parseFloat(cols[5]?.replace(/[¥￥]/g, '') || '0')
    if (!amount) continue
    const direction = cols[4]?.trim()
    const type = direction === '收入' ? 'income' : 'expense'
    const note = cols[3] || cols[2] || ''
    rows.push({ date, type, amount, note, category_name: '' })
  }
  return rows
}

export async function importParsedRows(rows: ParsedRow[], accountId: number | null): Promise<number> {
  const now = new Date().toISOString()
  let count = 0
  for (const row of rows) {
    await db.transactions.add({
      type: row.type,
      amount: row.amount,
      category_id: null,
      account_id: accountId,
      to_account_id: null,
      tags: [],
      note: row.note,
      date: row.date,
      book_id: null,
      is_excluded: false,
      is_reconciled: false,
      currency: 'CNY',
      exchange_rate: 1,
      reimbursement: null,
      refund_for: null,
      created_at: now,
      updated_at: now,
    })
    count++
  }
  return count
}

// ===== SVG Line Chart Helper =====
export function svgLinePath(data: number[], width: number, height: number, padding = 4): string {
  if (data.length < 2) return ''
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = (width - padding * 2) / (data.length - 1)
  const points = data.map((v, i) => {
    const x = padding + i * stepX
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })
  return `M${points.join(' L')}`
}
