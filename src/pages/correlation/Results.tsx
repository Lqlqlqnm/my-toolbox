import { useState, useEffect } from 'react'
import { db, type CorrelationVariable } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

interface Insight {
  type: 'positive' | 'negative' | 'pattern'
  title: string
  detail: string
  r: number | null
  varA: string
  varB: string
}

// Pearson correlation coefficient
function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n < 5) return 0
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0)
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0)
  const sumY2 = y.reduce((a, yi) => a + yi * yi, 0)
  const num = n * sumXY - sumX * sumY
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  return den === 0 ? 0 : num / den
}

export default function Results() {
  const variables = useLiveQuery(() => db.correlationVariables.where('is_active').equals(1).toArray())
  const records = useLiveQuery(() => db.correlationRecords.toArray())

  const [insights, setInsights] = useState<Insight[]>([])
  const [totalDays, setTotalDays] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!variables || !records) return
    setLoading(true)

    // Group records by date
    const byDate: Record<string, Record<number, number>> = {}
    for (const r of records) {
      if (!byDate[r.date]) byDate[r.date] = {}
      byDate[r.date][r.variable_id] = r.value
    }

    const dates = Object.keys(byDate).sort()
    setTotalDays(dates.length)

    if (dates.length < 14) {
      setInsights([])
      setLoading(false)
      return
    }

    const results: Insight[] = []

    // Pairwise correlations between all variables
    const numericVars = variables.filter(v => v.type === 'rating' || v.type === 'number')
    const boolVars = variables.filter(v => v.type === 'boolean')

    // Numeric vs Numeric
    for (let i = 0; i < numericVars.length; i++) {
      for (let j = i + 1; j < numericVars.length; j++) {
        const a = numericVars[i]
        const b = numericVars[j]
        const pairs = dates
          .map(d => [byDate[d][a.id!], byDate[d][b.id!]])
          .filter(([x, y]) => x !== undefined && y !== undefined)
        if (pairs.length < 14) continue

        const r = pearson(pairs.map(p => p[0]), pairs.map(p => p[1]))
        if (Math.abs(r) >= 0.3) {
          const avgA = pairs.reduce((s, p) => s + p[0], 0) / pairs.length
          const avgB = pairs.reduce((s, p) => s + p[1], 0) / pairs.length
          results.push({
            type: r > 0 ? 'positive' : 'negative',
            title: r > 0
              ? `${a.name}越高，${b.name}也越高`
              : `${a.name}越高，${b.name}反而越低`,
            detail: `相关系数 ${r.toFixed(2)} · 数据 ${pairs.length} 天 · ${a.name}均值 ${avgA.toFixed(1)}，${b.name}均值 ${avgB.toFixed(1)}`,
            r,
            varA: a.name,
            varB: b.name,
          })
        }
      }
    }

    // Boolean vs Numeric (point-biserial)
    for (const bv of boolVars) {
      for (const nv of numericVars) {
        const pairs = dates
          .map(d => [byDate[d][bv.id!], byDate[d][nv.id!]])
          .filter(([x, y]) => x !== undefined && y !== undefined)
        if (pairs.length < 14) continue

        const r = pearson(pairs.map(p => p[0]), pairs.map(p => p[1]))
        if (Math.abs(r) >= 0.3) {
          const yesVals = pairs.filter(p => p[0] === 1).map(p => p[1])
          const noVals = pairs.filter(p => p[0] === 0).map(p => p[1])
          const yesAvg = yesVals.length > 0 ? yesVals.reduce((a, b) => a + b, 0) / yesVals.length : 0
          const noAvg = noVals.length > 0 ? noVals.reduce((a, b) => a + b, 0) / noVals.length : 0
          const diff = Math.abs(yesAvg - noAvg).toFixed(1)

          results.push({
            type: r > 0 ? 'positive' : 'negative',
            title: r > 0
              ? `你${bv.name}的日子，${nv.name}平均高 ${diff} 分`
              : `你${bv.name}后，${nv.name}平均低 ${diff} 分`,
            detail: `${bv.name}日${nv.name}均值 ${yesAvg.toFixed(1)}，非${bv.name}日 ${noAvg.toFixed(1)} · 数据 ${pairs.length} 天`,
            r,
            varA: bv.name,
            varB: nv.name,
          })
        }
      }
    }

    // Weekday patterns for rating variables
    for (const v of numericVars.filter(v => v.type === 'rating')) {
      const weekdayAvg: number[] = Array(7).fill(0)
      const weekdayCnt: number[] = Array(7).fill(0)
      for (const d of dates) {
        const val = byDate[d][v.id!]
        if (val === undefined) continue
        const day = new Date(d).getDay()
        weekdayAvg[day] += val
        weekdayCnt[day]++
      }
      for (let i = 0; i < 7; i++) {
        if (weekdayCnt[i] > 0) weekdayAvg[i] /= weekdayCnt[i]
      }

      const validDays = weekdayAvg.map((avg, i) => ({ avg, i, cnt: weekdayCnt[i] })).filter(d => d.cnt >= 2)
      if (validDays.length < 5) continue

      const overallAvg = validDays.reduce((s, d) => s + d.avg, 0) / validDays.length
      const worst = validDays.reduce((min, d) => d.avg < min.avg ? d : min)
      const best = validDays.reduce((max, d) => d.avg > max.avg ? d : max)

      const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

      if (overallAvg - worst.avg > 0.5) {
        results.push({
          type: 'pattern',
          title: `${weekNames[worst.i]}是你${v.name}最低的一天`,
          detail: `${weekNames[worst.i]}${v.name}均值 ${worst.avg.toFixed(1)}，全周均值 ${overallAvg.toFixed(1)}`,
          r: null,
          varA: v.name,
          varB: weekNames[worst.i],
        })
      }
      if (best.avg - overallAvg > 0.5) {
        results.push({
          type: 'pattern',
          title: `${weekNames[best.i]}是你${v.name}最高的一天`,
          detail: `${weekNames[best.i]}${v.name}均值 ${best.avg.toFixed(1)}，全周均值 ${overallAvg.toFixed(1)}`,
          r: null,
          varA: v.name,
          varB: weekNames[best.i],
        })
      }
    }

    // Sort by absolute r value
    results.sort((a, b) => Math.abs(b.r || 0.4) - Math.abs(a.r || 0.4))
    setInsights(results)
    setLoading(false)
  }, [variables, records])

  if (loading && !variables) return null

  return (
    <div className="p-4 pb-10">
      {/* Stats */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-gray-800 dark:text-white">{totalDays}</p>
          <p className="text-[10px] text-gray-400">记录天数</p>
        </div>
        <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-gray-800 dark:text-white">{insights.length}</p>
          <p className="text-[10px] text-gray-400">发现数</p>
        </div>
        <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-gray-800 dark:text-white">{variables?.length || 0}</p>
          <p className="text-[10px] text-gray-400">追踪变量</p>
        </div>
      </div>

      {/* Not enough data */}
      {totalDays < 14 && (
        <div className="bg-white dark:bg-[#141416] rounded-xl p-6 text-center">
          <p className="text-3xl mb-3">🔬</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">数据还不够</p>
          <p className="text-xs text-gray-400 mb-4">再记录 {14 - totalDays} 天就能看到第一批分析结果</p>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden max-w-[200px] mx-auto">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(totalDays / 14) * 100}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">{totalDays}/14 天</p>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`bg-white dark:bg-[#141416] rounded-xl p-4 border-l-4 ${
                insight.type === 'positive' ? 'border-l-green-500' :
                insight.type === 'negative' ? 'border-l-red-500' :
                'border-l-indigo-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  insight.type === 'positive' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  insight.type === 'negative' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                }`}>
                  {insight.type === 'positive' ? '正相关' : insight.type === 'negative' ? '负相关' : '规律'}
                </span>
                {insight.r !== null && (
                  <span className="text-[10px] text-gray-400">r = {insight.r.toFixed(2)}</span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-relaxed">{insight.title}</p>
              <p className="text-xs text-gray-400 mt-1.5">{insight.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* Has data but no insights */}
      {totalDays >= 14 && insights.length === 0 && (
        <div className="bg-white dark:bg-[#141416] rounded-xl p-6 text-center">
          <p className="text-3xl mb-3">🤔</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">暂未发现明显关联</p>
          <p className="text-xs text-gray-400">继续记录更多天数，或者尝试添加新变量</p>
        </div>
      )}
    </div>
  )
}
