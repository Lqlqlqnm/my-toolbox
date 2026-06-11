import { useState, useEffect } from 'react'
import { getStats } from '../../lib/api'

export default function Stats() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
  }, [])

  if (!stats) return <p className="text-xs text-gray-400 text-center py-6">暂无已平仓数据，无法统计</p>

  return (
    <div className="space-y-4">
      {/* Stats grid - gradient card */}
      <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1f2937, #111827)' }}>
        <div className="grid grid-cols-2 gap-3">
          <StatItem label="总交易" value={`${stats.totalTrades} 笔`} />
          <StatItem label="胜率" value={`${stats.winRate.toFixed(1)}%`} highlight={stats.winRate >= 50} />
          <StatItem label="总盈亏" value={`${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(0)}`} highlight={stats.totalPnl >= 0} />
          <StatItem label="平均收益" value={`${stats.avgPnlPct >= 0 ? '+' : ''}${stats.avgPnlPct.toFixed(1)}%`} highlight={stats.avgPnlPct >= 0} />
          <StatItem label="平均持有" value={`${stats.avgHoldDays.toFixed(0)} 天`} />
          <StatItem label="盈亏比" value={`${stats.winCount}:${stats.lossCount}`} />
          <StatItem label="最大盈利" value={`+${stats.maxWin.toFixed(1)}%`} highlight />
          <StatItem label="最大亏损" value={`${stats.maxLoss.toFixed(1)}%`} />
        </div>
      </div>

      {/* Reason breakdown */}
      <div>
        <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2">卖出原因分布</p>
        <div className="space-y-2">
          {Object.entries(stats.reasonBreakdown || {}).map(([reason, data]: [string, any]) => (
            <div key={reason} className="rounded-xl p-3 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${data.avgPnl >= 0 ? 'bg-green-400' : 'bg-red-400'} dark:hidden`} />
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-900 dark:text-white font-medium">{reasonLabel(reason)}</span>
                <div className="flex gap-3">
                  <span className="text-gray-400">{data.count} 笔</span>
                  <span className={data.avgPnl >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                    平均 {data.avgPnl >= 0 ? '+' : ''}{data.avgPnl.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-white/50">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = { stop_loss: '止损', trailing_stop: '移动止盈', extreme_rally: '极端加速', max_hold: '到期清仓', manual: '手动' }
  return map[reason] || reason
}
