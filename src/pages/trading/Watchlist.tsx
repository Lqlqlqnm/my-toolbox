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
      <button onClick={() => setShowAdd(!showAdd)} className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600">+ 添加自选</button>

      {showAdd && (
        <div className="p-4 bg-white dark:bg-[#141416] rounded-xl border border-gray-100 dark:border-white/[0.06] shadow-sm space-y-2">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="ETF代码（6位，如510300）" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/[0.06] rounded-lg bg-gray-50 dark:bg-[#0c0c0d]" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="名称（可选）" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/[0.06] rounded-lg bg-gray-50 dark:bg-[#0c0c0d]" />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="关注原因（可选）" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/[0.06] rounded-lg bg-gray-50 dark:bg-[#0c0c0d]" />
          <button onClick={handleAdd} className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm">添加</button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">暂无自选，点击上方添加</p>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => {
            const q = quotes[item.code]
            const changeColor = q && q.change >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'
            const barColor = q && q.change >= 0 ? 'bg-green-400' : 'bg-red-400'
            const iconBg = q && q.change >= 0 ? 'bg-green-500/10' : q ? 'bg-red-500/10' : 'bg-gray-500/10'
            return (
              <div key={item.id} className="rounded-xl p-3 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${q ? barColor : 'bg-gray-200'} dark:hidden`} />
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{(q?.name || item.name || '').slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{q?.name || item.name}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-600">{item.code}</span>
                    </div>
                    {item.reason && <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 truncate">{item.reason}</p>}
                  </div>
                  <div className="text-right">
                    {q ? (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{q.price.toFixed(3)}</p>
                        <p className={`text-xs font-medium ${changeColor}`}>{q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%</p>
                      </>
                    ) : <p className="text-[10px] text-gray-400">--</p>}
                  </div>
                  <button onClick={() => handleRemove(item.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 ml-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
