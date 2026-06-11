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
      <div className="bg-white dark:bg-[#141416] rounded-lg p-4 border border-gray-200 dark:border-white/[0.06]">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-500">总资产</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{totalAsset.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">可用资金</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{(portfolio?.cash || 0).toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">总盈亏</p>
            <p className={`text-sm font-medium ${totalPnl >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(0)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%)
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">当前持仓 ({holding.length})</h3>
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

              return (
                <div key={pos.id} className="p-3 bg-white dark:bg-[#141416] rounded-lg border border-gray-100 dark:border-white/[0.06]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{pos.name}</span>
                    <span className={`text-sm font-medium ${pnlPct >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{pos.remaining_shares}股 | 成本{pos.buy_price.toFixed(3)}</span>
                    <span>浮盈{pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>现价 {currentPrice.toFixed(3)} | 最高 {pos.highest_price.toFixed(3)}</span>
                    <span className={trailingActive ? 'text-amber-500' : ''}>
                      {trailingActive ? '止盈已激活' : `待激活(>${pos.activation_pct}%)`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    止损{pos.stop_loss_pct}% | 回撤{pos.trailing_pct}% | {pos.max_hold_days}天
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <button onClick={() => setShowClosed(!showClosed)} className="text-sm text-gray-500 hover:text-gray-700">
          {showClosed ? '收起' : `已平仓 (${closed.length})`}
        </button>
        {showClosed && closed.length > 0 && (
          <div className="mt-2 space-y-2">
            {closed.map((pos: any) => (
              <div key={pos.id} className="p-2 bg-gray-50 dark:bg-[#0c0c0d] rounded text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{pos.name}({pos.code})</span>
                  <span className={pos.pnl_pct >= 0 ? 'text-red-500' : 'text-green-500'}>
                    {pos.pnl_pct != null ? `${pos.pnl_pct >= 0 ? '+' : ''}${pos.pnl_pct.toFixed(1)}%` : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400 mt-0.5">
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
