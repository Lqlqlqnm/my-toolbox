import { useState, useEffect } from 'react'
import { getWatchlist, addWatchlistItem, deleteWatchlistItem } from '../../lib/api'
import { fetchQuotes, type QuoteData } from '../../lib/quotes'

export default function Watchlist() {
  const [items, setItems] = useState<any[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({})
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(refreshQuotes, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const list = await getWatchlist()
      setItems(list || [])
      if (list && list.length > 0) {
        const q = await fetchQuotes(list.map((i: any) => i.code))
        setQuotes(q)
      }
    } catch {}
  }

  async function refreshQuotes() {
    if (items.length === 0) return
    const q = await fetchQuotes(items.map(i => i.code))
    setQuotes(q)
  }

  async function handleAdd() {
    if (!code.trim() || code.trim().length !== 6) return
    await addWatchlistItem(code.trim(), name.trim() || code.trim(), reason.trim())
    setCode(''); setName(''); setReason('')
    setShowAdd(false)
    await loadData()
  }

  async function handleRemove(id: number) {
    await deleteWatchlistItem(id)
    await loadData()
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowAdd(!showAdd)} className="text-sm text-blue-500 hover:text-blue-600">+ 添加自选</button>

      {showAdd && (
        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="ETF代码（6位，如510300）" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="名称（可选）" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="关注原因（可选）" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
          <button onClick={handleAdd} className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm">添加</button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">暂无自选，点击上方添加</p>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => {
            const q = quotes[item.code]
            return (
              <div key={item.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{q?.name || item.name}</span>
                    <span className="text-xs text-gray-400">{item.code}</span>
                  </div>
                  {item.reason && <p className="text-xs text-gray-400 mt-0.5">{item.reason}</p>}
                </div>
                <div className="text-right">
                  {q ? (
                    <>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{q.price.toFixed(3)}</p>
                      <p className={`text-xs ${q.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>{q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%</p>
                    </>
                  ) : <p className="text-xs text-gray-400">加载中</p>}
                  <button onClick={() => handleRemove(item.id)} className="text-xs text-gray-400 hover:text-red-500 mt-1">删除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
