import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { db, type Transaction, type Account } from '../../lib/db'
import { svgLinePath } from '../../lib/accounting-utils'

type TimeRange = '30d' | '6m' | '1y'

export default function AssetTrend() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => { loadData() }, [timeRange])

  async function loadData() {
    const now = new Date()
    const start = new Date()
    if (timeRange === '30d') start.setDate(now.getDate() - 30)
    else if (timeRange === '6m') start.setMonth(now.getMonth() - 6)
    else start.setFullYear(now.getFullYear() - 1)

    const startDate = start.toISOString().slice(0, 10)
    const endDate = now.toISOString().slice(0, 10)

    const txns = await db.transactions
      .where('date')
      .between(startDate, endDate, true, true)
      .sortBy('date')

    const accts = await db.accounts.toArray()
    setTransactions(txns)
    setAccounts(accts)
  }

  // Calculate net worth snapshots over time
  const chartData = useMemo(() => {
    if (accounts.length === 0) return { points: [], labels: [] }

    // Current total balance
    const currentTotal = accounts.reduce((sum, a) => sum + a.balance, 0)

    // Determine date points based on time range
    const now = new Date()
    const points: { date: string; value: number }[] = []
    let numPoints: number
    let stepDays: number

    if (timeRange === '30d') {
      numPoints = 30; stepDays = 1
    } else if (timeRange === '6m') {
      numPoints = 26; stepDays = 7 // weekly
    } else {
      numPoints = 12; stepDays = 30 // ~monthly
    }

    // Build date list from newest to oldest
    const dates: string[] = []
    for (let i = 0; i < numPoints; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * stepDays)
      dates.unshift(d.toISOString().slice(0, 10))
    }

    // Reconstruct historical balances by walking backwards
    // Start from current balance and subtract/add transactions going back in time
    let runningTotal = currentTotal
    const dateValueMap = new Map<string, number>()
    dateValueMap.set(dates[dates.length - 1], runningTotal)

    // Sort transactions by date descending to walk backwards
    const sortedTxns = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

    let txIdx = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      const targetDate = dates[i]
      // Process all transactions after this date (reverse their effect)
      while (txIdx < sortedTxns.length && sortedTxns[txIdx].date > targetDate) {
        const t = sortedTxns[txIdx]
        if (t.type === 'expense') runningTotal += t.amount
        else if (t.type === 'income') runningTotal -= t.amount
        // transfers don't affect net worth
        txIdx++
      }
      dateValueMap.set(targetDate, runningTotal)
    }

    const values = dates.map(d => dateValueMap.get(d) || 0)
    const labels = dates.map(d => {
      const [, m, day] = d.split('-')
      return timeRange === '1y' ? `${parseInt(m)}月` : `${parseInt(m)}/${parseInt(day)}`
    })

    return { points: values, labels, dates }
  }, [transactions, accounts, timeRange])

  const chartWidth = 340
  const chartHeight = 160
  const padding = 20
  const path = svgLinePath(chartData.points, chartWidth, chartHeight, padding)
  const minVal = chartData.points.length > 0 ? Math.min(...chartData.points) : 0
  const maxVal = chartData.points.length > 0 ? Math.max(...chartData.points) : 0

  // Calculate dot positions for hover
  const dotPositions = useMemo(() => {
    if (chartData.points.length < 2) return []
    const range = maxVal - minVal || 1
    const stepX = (chartWidth - padding * 2) / (chartData.points.length - 1)
    return chartData.points.map((v, i) => ({
      x: padding + i * stepX,
      y: chartHeight - padding - ((v - minVal) / range) * (chartHeight - padding * 2),
    }))
  }, [chartData.points, maxVal, minVal])

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">资产趋势</h1>
        <div className="w-5" />
      </div>

      {/* Current Net Worth */}
      <div className="bg-white dark:bg-[#141416] rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-white/[0.06] text-center">
        <p className="text-xs text-gray-400 mb-1">当前净资产</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-white">
          ¥{accounts.reduce((s, a) => s + a.balance, 0).toFixed(2)}
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="flex bg-gray-100 dark:bg-[#141416] rounded-lg p-0.5 mb-4">
        {([['30d', '近30天'], ['6m', '近6月'], ['1y', '近1年']] as [TimeRange, string][]).map(([range, label]) => (
          <button key={range} onClick={() => setTimeRange(range)}
            className={`flex-1 py-1.5 text-xs rounded-md font-medium ${timeRange === range ? 'bg-white dark:bg-gray-700 shadow-sm text-amber-600' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="bg-white dark:bg-[#141416] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-white/[0.06]">
        {chartData.points.length < 2 ? (
          <p className="text-gray-400 text-sm text-center py-8">数据不足，至少需要两个时间点</p>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-40"
              onMouseLeave={() => setHoverIdx(null)}
            >
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map(ratio => (
                <line key={ratio}
                  x1={padding} x2={chartWidth - padding}
                  y1={chartHeight - padding - ratio * (chartHeight - padding * 2)}
                  y2={chartHeight - padding - ratio * (chartHeight - padding * 2)}
                  stroke="currentColor" className="text-gray-100 dark:text-gray-700" strokeWidth="0.5" />
              ))}
              {/* Line */}
              <path d={path} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Area fill */}
              {path && (
                <path
                  d={`${path} L${chartWidth - padding},${chartHeight - padding} L${padding},${chartHeight - padding} Z`}
                  fill="url(#areaGradient)" opacity="0.3"
                />
              )}
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Hover dots */}
              {dotPositions.map((pos, i) => (
                <circle key={i} cx={pos.x} cy={pos.y} r={hoverIdx === i ? 4 : 2}
                  fill={hoverIdx === i ? '#f59e0b' : 'transparent'}
                  stroke={hoverIdx === i ? '#f59e0b' : 'transparent'}
                  onMouseEnter={() => setHoverIdx(i)}
                  className="cursor-pointer"
                />
              ))}
              {/* Invisible hover targets */}
              {dotPositions.map((pos, i) => (
                <rect key={`hit-${i}`} x={pos.x - 8} y={0} width={16} height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              ))}
            </svg>
            {/* Tooltip */}
            {hoverIdx !== null && dotPositions[hoverIdx] && (
              <div
                className="absolute bg-gray-800 text-white text-xs px-2 py-1 rounded shadow pointer-events-none whitespace-nowrap"
                style={{
                  left: `${(dotPositions[hoverIdx].x / chartWidth) * 100}%`,
                  top: `${(dotPositions[hoverIdx].y / chartHeight) * 100 - 12}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {chartData.labels[hoverIdx]}: ¥{chartData.points[hoverIdx].toFixed(0)}
              </div>
            )}
          </div>
        )}
        {/* X-axis labels */}
        {chartData.labels.length > 0 && (
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[10px] text-gray-300">{chartData.labels[0]}</span>
            <span className="text-[10px] text-gray-300">{chartData.labels[Math.floor(chartData.labels.length / 2)]}</span>
            <span className="text-[10px] text-gray-300">{chartData.labels[chartData.labels.length - 1]}</span>
          </div>
        )}
        {/* Min/Max labels */}
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[10px] text-gray-400">最低: ¥{minVal.toFixed(0)}</span>
          <span className="text-[10px] text-gray-400">最高: ¥{maxVal.toFixed(0)}</span>
        </div>
      </div>
    </main>
  )
}
