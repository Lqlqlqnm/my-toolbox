import { useState, useEffect } from 'react'
import { getStats } from '../../lib/api'
import { getAIConfig } from '../../lib/ai'

export default function Stats() {
  const [stats, setStats] = useState<any>(null)
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewResult, setReviewResult] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
  }, [])

  if (!stats) return (
    <div className="text-center py-10 text-gray-400 text-sm">
      <p>暂无统计数据</p>
      <p className="text-xs mt-1">策略运行后将自动记录收益</p>
    </div>
  )

  const expectancyOk = stats.expectancy > 1

  // Calendar logic
  const [calYear, calMonthNum] = calMonth.split('-').map(Number)
  const daysInMonth = new Date(calYear, calMonthNum, 0).getDate()
  const firstDayOfWeek = (new Date(calYear, calMonthNum - 1, 1).getDay() + 6) % 7 // Mon=0
  const calendarDays = stats.calendar?.filter((d: any) =>
    d.date.startsWith(calMonth)
  ) || []
  const dayMap = new Map(calendarDays.map((d: any) => [parseInt(d.date.split('-')[2]), d.pnl]))

  function prevMonth() {
    const [y, m] = calMonth.split('-').map(Number)
    setCalMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = calMonth.split('-').map(Number)
    setCalMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-4">
      {/* Core metrics card */}
      <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-gray-400">策略表现</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${expectancyOk ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {expectancyOk ? '✓ 正期望' : '✗ 负期望'} ({stats.expectancy?.toFixed(2)})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-500">总收益</p>
              <p className={`text-xl font-bold ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalPnl >= 0 ? '+' : ''}¥{stats.totalPnl?.toFixed(0)}
              </p>
              <p className="text-[10px] text-gray-500">{stats.totalReturn?.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">最大回撤</p>
              <p className="text-xl font-bold text-white">-{stats.maxDrawdown?.toFixed(1)}%</p>
              <p className="text-[10px] text-gray-500">初始 ¥{(stats.initialCapital / 10000).toFixed(0)}万</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
            <div>
              <p className="text-[10px] text-gray-500">胜率</p>
              <p className="text-sm font-medium text-white">{stats.winRate?.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">盈亏比</p>
              <p className="text-sm font-medium text-white">{stats.profitRatio?.toFixed(1)}:1</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">交易笔数</p>
              <p className="text-sm font-medium text-white">{stats.totalTrades}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-200">收益日历</p>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="text-gray-400 text-sm">‹</button>
            <span className="text-xs text-gray-500">{calYear}年{calMonthNum}月</span>
            <button onClick={nextMonth} className="text-gray-400 text-sm">›</button>
          </div>
        </div>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['一', '二', '三', '四', '五', '六', '日'].map(d => (
            <div key={d} className="text-center text-[9px] text-gray-400">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const pnl = dayMap.get(day)
            const hasPnl = pnl !== undefined
            const isPositive = (pnl || 0) > 0
            const isNegative = (pnl || 0) < 0
            const intensity = hasPnl ? Math.min(Math.abs(pnl) / 500, 1) : 0
            return (
              <div key={day} className={`aspect-square rounded flex flex-col items-center justify-center text-[9px] ${
                isPositive ? `bg-green-500/${Math.round(10 + intensity * 30)}` :
                isNegative ? `bg-red-500/${Math.round(10 + intensity * 30)}` :
                'bg-gray-50 dark:bg-white/[0.02]'
              }`}>
                <span className="text-gray-400">{day}</span>
                {hasPnl && (
                  <span className={`text-[8px] font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {pnl > 0 ? '+' : ''}{pnl.toFixed(0)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {calendarDays.length === 0 && (
          <p className="text-center text-[10px] text-gray-300 mt-2">本月暂无数据</p>
        )}
      </div>

      {/* Per-stock breakdown */}
      {stats.perStock && stats.perStock.length > 0 && (
        <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-3">个股盈亏</p>
          <div className="space-y-2">
            {stats.perStock.map((s: any) => (
              <div key={s.code} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-white/[0.04] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-white truncate">{s.name}<span className="text-xs text-gray-400 ml-1">({s.code})</span></p>
                  <p className="text-[10px] text-gray-400">{s.trades}笔 · 胜率{s.winRate.toFixed(0)}% · 均持{s.avgDays}天</p>
                </div>
                <span className={`text-sm font-medium ${s.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {s.totalPnl >= 0 ? '+' : ''}¥{s.totalPnl.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {stats.totalTrades === 0 && (
        <div className="text-center py-4 text-gray-400 text-xs">
          <p>还没有已平仓的交易</p>
          <p className="mt-1">条件单触发并完成卖出后将显示收益数据</p>
        </div>
      )}

      {/* AI Strategy Review */}
      <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-200">AI 策略复盘</p>
          <button
            onClick={handleAIReview}
            disabled={reviewLoading || stats.totalTrades === 0}
            className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            {reviewLoading ? '分析中...' : '开始复盘'}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mb-2">基于历史交易数据，AI 诊断策略问题并给出参数优化建议</p>
        {reviewError && <p className="text-xs text-red-500 mb-2">{reviewError}</p>}
        {reviewResult && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-[#0c0c0d] rounded-lg text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {reviewResult}
          </div>
        )}
      </div>
    </div>
  )

  async function handleAIReview() {
    const config = getAIConfig()
    if (!config) { setReviewError('请先在设置中配置 AI API Key'); return }

    setReviewLoading(true)
    setReviewError('')
    setReviewResult(null)

    const prompt = `你是一位量化策略优化顾问。请根据以下模拟盘数据诊断策略表现并给出具体优化建议。

## 当前策略参数
- 买入：基于AI文章分析 + 技术面信号（放量突破回踩、缩量企稳、恐慌不创新低）确定触发价
- 卖出规则：固定止损 / 移动止盈（激活后回撤触发）/ 极端加速减仓（日涨>7%卖半仓）/ 最大持有期
- 仓位：每单5-30%

## 模拟盘数据
- 初始资金: ¥${stats.initialCapital}
- 总收益: ¥${stats.totalPnl?.toFixed(2)} (${stats.totalReturn?.toFixed(2)}%)
- 最大回撤: ${stats.maxDrawdown?.toFixed(2)}%
- 胜率: ${stats.winRate?.toFixed(1)}%
- 盈亏比: ${stats.profitRatio?.toFixed(2)}:1
- 期望值: ${stats.expectancy?.toFixed(3)}
- 总交易笔数: ${stats.totalTrades}

## 个股表现
${(stats.perStock || []).map((s: any) => `${s.name}(${s.code}): ${s.trades}笔, 胜率${s.winRate.toFixed(0)}%, 均持${s.avgDays}天, 盈亏¥${s.totalPnl.toFixed(0)}`).join('\n')}

## 近期每日盈亏
${(stats.calendar || []).slice(-20).map((d: any) => `${d.date}: ${d.pnl >= 0 ? '+' : ''}¥${d.pnl.toFixed(0)}`).join('\n')}

## 请输出
1. **策略诊断**：当前最大的问题是什么（如：止损太紧/太松、持仓期不合理、选品问题等）
2. **参数建议**：具体建议调整哪些参数（给出旧值→新值）
3. **品种建议**：哪些ETF适合当前策略、哪些应该回避
4. **综合评分**：1-10分评估当前策略健康度

请用中文回答，简洁直接，不要客套。`

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
        }),
      })

      if (!response.ok) throw new Error(`AI 请求失败: ${response.status}`)
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('AI 返回为空')
      setReviewResult(content)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : '复盘失败')
    } finally {
      setReviewLoading(false)
    }
  }
}
