import { useState, useEffect } from 'react'
import { getOrders, cancelOrder } from '../../lib/api'

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'executed' | 'cancelled'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    try {
      const all = await getOrders('all')
      setOrders(all || [])
    } catch {}
  }

  async function handleCancel(id: number) {
    await cancelOrder(id)
    await loadOrders()
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['all', 'pending', 'executed', 'cancelled'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full ${
              filter === f ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-[#141416] text-gray-600 dark:text-gray-400'
            }`}
          >
            {f === 'all' ? '全部' : f === 'pending' ? '等待中' : f === 'executed' ? '已成交' : '已取消'}
            {f !== 'all' && ` (${orders.filter(o => o.status === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">暂无条件单</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((order: any) => {
            const barColor = order.status === 'pending' ? 'bg-amber-400' : order.status === 'executed' ? 'bg-green-400' : 'bg-gray-300'
            const iconBg = order.status === 'pending' ? 'bg-amber-500/10' : order.status === 'executed' ? 'bg-green-500/10' : 'bg-gray-500/10'
            const isExpanded = expandedId === order.id
            return (
            <div key={order.id} className="rounded-xl bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${barColor} dark:hidden`} />
              {/* Header - always visible, clickable */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
              >
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                  <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{order.name?.slice(0, 2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {order.name}
                      <span className="text-xs text-gray-400 font-normal ml-1">({order.code})</span>
                    </span>
                    <StatusBadge status={order.status} cancelReason={order.cancel_reason} />
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
                    触发 ¥{order.trigger_price?.toFixed(3)} · 仓位 {order.position_pct}% · {order.created_at?.split('T')[0]}
                  </div>
                </div>
                <svg className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 text-[10px] text-gray-400 dark:text-gray-600 border-t border-gray-50 dark:border-white/[0.04] pt-2">
                  <div>止损{order.stop_loss_pct}% | 回撤{order.trailing_pct}% | 激活{order.activation_pct}% | {order.max_hold_days}天</div>
                  {order.reason && <div className="mt-1 text-gray-500 dark:text-gray-400">{order.reason}</div>}
                  {order.status === 'executed' && order.executed_price && (
                    <div className="mt-1 text-green-500 dark:text-green-400">
                      成交 {order.executed_shares}股 @ ¥{order.executed_price.toFixed(3)} · {order.executed_at?.split('T')[0]}
                    </div>
                  )}
                  {order.status === 'cancelled' && order.cancel_reason && (
                    <div className="mt-1 text-gray-400">取消原因: {order.cancel_reason === 'superseded' ? '被新分析替换' : order.cancel_reason === 'manual' ? '手动取消' : order.cancel_reason}</div>
                  )}
                  {order.status === 'pending' && (
                    <button onClick={(e) => { e.stopPropagation(); handleCancel(order.id) }} className="mt-2 text-xs text-red-500 hover:text-red-600">取消条件单</button>
                  )}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, cancelReason }: { status: string; cancelReason: string | null }) {
  if (status === 'pending') return <span className="px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] rounded-full border border-green-500/20">监控中</span>
  if (status === 'executed') return <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] rounded-full border border-blue-500/20">已成交</span>
  if (cancelReason === 'superseded') return <span className="px-2 py-0.5 bg-gray-500/10 text-gray-500 text-[10px] rounded-full">已替换</span>
  return <span className="px-2 py-0.5 bg-gray-500/10 text-gray-500 text-[10px] rounded-full">已取消</span>
}
