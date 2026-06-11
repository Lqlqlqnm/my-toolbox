import { useState, useEffect } from 'react'
import { getPortfolio, getPositions } from '../../lib/api'
import { fetchQuotes, type QuoteData } from '../../lib/quotes'

export default function Positions() {
  const [holding, setHolding] = useState<any[]>([])
  const [closed, setClosed] = useState<any[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({})
  const [portfolio, setPortfolio] = useState<any>(null)
  const [showClosed, setShowClosed] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(refreshQuotes, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const p = await getPortfolio()
      setPortfolio(p)
      const h = await getPositions('holding')
      setHolding(h || [])
      const c = await getPositions('closed')
      setClosed((c || []).slice(0, 50))
      if (h && h.length > 0) {
        const q = await fetchQuotes(h.map((pos: any) => pos.code))
        setQuotes(q)
      }
    } catch {}
  }

  async function refreshQuotes() {
    if (holding.length === 0) return
    const q = await fetchQuotes(holding.map(pos => pos.code))
    setQuotes(q)
  }

  const holdingValue = holding.reduce((sum, pos) => {
    const q = quotes[pos.code]
    return sum + (q?.price || pos.buy_price) * pos.remaining_shares
  }, 0)
  const totalAsset = (portfolio?.cash || 0) + holdingValue
  const totalPnl = totalAsset - (portfolio?.initial_capital || 0)
  const totalPnlPct = portfolio?.initial_capital ? (totalPnl / portfolio.initial_capital) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Portfolio Overview - gradient card like prototype */}
      <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' }}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
        <div className="relative">
          <p className="text-[10px] text-blue-300/50">模拟仓总览</p>
          <p className="text-2xl font-bold text-white mt-1">¥{totalAsset.toFixed(0)}</p>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-gray-400">可用 ¥{(portfolio?.cash || 0).toFixed(0)}</span>
            <span className={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(0)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2">持仓 ({holding.length})</p>
        {holding.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">暂无持仓</p>
        ) : (
          <div className="space-y-2">
            {holding.map((pos: any) => {
              const q = quotes[pos.code]
              const currentPrice = q?.price || pos.buy_price
              const pnlPct = ((currentPrice - pos.buy_price) / pos.buy_price) * 100
              const pnl = (currentPrice - pos.buy_price) * pos.remaining_shares
              const highProfitPct = ((pos.highest_price - pos.buy_price) / pos.buy_price) * 100
              const trailingActive = highProfitPct >= pos.activation_pct
              const barColor = pnlPct >= 0 ? 'bg-green-400' : 'bg-red-400'
              const iconBg = pnlPct >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              const iconText = pnlPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

              return (
                <div key={pos.id} className="rounded-xl p-3 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${barColor} dark:hidden`} />
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                      <span className={`text-[10px] font-bold ${iconText}`}>{pos.name.slice(0, 2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{pos.name}</span>
                        <span className={`text-sm font-medium ${pnlPct >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
                        <span>{pos.code} · {pos.remaining_shares}股 · 成本{pos.buy_price.toFixed(3)}</span>
                        <span>¥{pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-600 mt-2 pt-2 border-t border-gray-50 dark:border-white/[0.04]">
                    <span>现价 {currentPrice.toFixed(3)}</span>
                    <span className={trailingActive ? 'text-amber-500' : ''}>
                      {trailingActive ? '止盈已激活' : `止损${pos.stop_loss_pct}% | 回撤${pos.trailing_pct}%`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <button onClick={() => setShowClosed(!showClosed)} className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600">
          {showClosed ? '收起' : `已平仓 (${closed.length})`}
        </button>
        {showClosed && closed.length > 0 && (
          <div className="mt-2 space-y-2">
            {closed.map((pos: any) => (
              <div key={pos.id} className="p-3 rounded-xl bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] text-xs relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${(pos.pnl_pct || 0) >= 0 ? 'bg-green-400' : 'bg-red-400'} dark:hidden`} />
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{pos.name}({pos.code})</span>
                  <span className={(pos.pnl_pct || 0) >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                    {pos.pnl_pct != null ? `${pos.pnl_pct >= 0 ? '+' : ''}${pos.pnl_pct.toFixed(1)}%` : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400 dark:text-gray-600 mt-0.5">
                  <span>{pos.buy_date} ~ {pos.close_date}</span>
                  <span>{reasonLabel(pos.close_reason)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function reasonLabel(reason: string | null): string {
  const map: Record<string, string> = { stop_loss: '止损', trailing_stop: '移动止盈', extreme_rally: '极端加速', max_hold: '到期', manual: '手动' }
  return map[reason || ''] || '-'
}
