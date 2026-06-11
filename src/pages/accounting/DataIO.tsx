import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db, type Account } from '../../lib/db'
import { exportCSV, parseWeChatCSV, parseAlipayCSV, importParsedRows } from '../../lib/accounting-utils'

export default function DataIO() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [exportStart, setExportStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [exportEnd, setExportEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [importAccountId, setImportAccountId] = useState<number | null>(null)
  const [importPreview, setImportPreview] = useState<{ count: number; source: string } | null>(null)
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [importMsg, setImportMsg] = useState('')

  useEffect(() => {
    db.accounts.orderBy('sort_order').filter(a => !a.is_hidden).toArray().then(accts => {
      setAccounts(accts)
      if (accts.length > 0) setImportAccountId(accts[0].id!)
    })
  }, [])

  async function handleExport() {
    const csv = await exportCSV(exportStart, exportEnd)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `记账导出_${exportStart}_${exportEnd}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()

    // Try WeChat first, then Alipay
    let rows = parseWeChatCSV(text)
    let source = '微信'
    if (rows.length === 0) {
      rows = parseAlipayCSV(text)
      source = '支付宝'
    }
    if (rows.length === 0) {
      setImportMsg('无法识别文件格式，请确认是微信或支付宝导出的 CSV')
      setImportPreview(null)
      setParsedRows([])
      return
    }
    setParsedRows(rows)
    setImportPreview({ count: rows.length, source })
    setImportMsg('')
  }

  async function doImport() {
    if (parsedRows.length === 0) return
    const count = await importParsedRows(parsedRows, importAccountId)
    setImportMsg(`成功导入 ${count} 条记录`)
    setParsedRows([])
    setImportPreview(null)
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">导入导出</h1>
        <div className="w-5" />
      </div>

      {/* Export Section */}
      <div className="bg-white dark:bg-[#141416] rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-white/[0.06]">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">CSV 导出</h2>
        <div className="flex items-center gap-2 mb-3">
          <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
          <span className="text-gray-400 text-xs">至</span>
          <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
        </div>
        <button onClick={handleExport} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl text-sm">
          导出 CSV 文件
        </button>
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-[#141416] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-white/[0.06]">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">CSV 导入</h2>
        <p className="text-xs text-gray-400 mb-3">支持微信支付、支付宝账单 CSV 格式</p>

        <div className="mb-3">
          <label className="text-xs text-gray-400">导入到账户</label>
          <select value={importAccountId ?? ''} onChange={e => setImportAccountId(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600">
            {accounts.map(a => (
              <option key={a.id} value={a.id!}>{a.name}</option>
            ))}
          </select>
        </div>

        <label className="block w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 font-medium rounded-xl text-sm text-center cursor-pointer mb-3">
          选择 CSV 文件
          <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        </label>

        {importPreview && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              识别为 <strong>{importPreview.source}</strong> 账单，共 {importPreview.count} 条记录
            </p>
          </div>
        )}

        {importPreview && (
          <button onClick={doImport} className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl text-sm">
            确认导入 {importPreview.count} 条
          </button>
        )}

        {importMsg && (
          <p className={`text-sm mt-3 text-center ${importMsg.includes('成功') ? 'text-green-500' : 'text-red-500'}`}>
            {importMsg}
          </p>
        )}
      </div>
    </main>
  )
}
