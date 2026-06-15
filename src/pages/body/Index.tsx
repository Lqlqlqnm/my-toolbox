import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BodyPerson, type BodyMeasurement } from '../../lib/db'
import { ChevronLeft, Plus } from 'lucide-react'

const TYPES = [
  { key: 'weight', label: '体重', unit: 'kg', icon: '⚖️' },
  { key: 'height', label: '身高', unit: 'cm', icon: '📏' },
  { key: 'chest', label: '胸围', unit: 'cm', icon: '📐' },
  { key: 'waist', label: '腰围', unit: 'cm', icon: '📐' },
  { key: 'hip', label: '臀围', unit: 'cm', icon: '📐' },
  { key: 'neck', label: '颈围', unit: 'cm', icon: '👔' },
  { key: 'arm', label: '上臂围', unit: 'cm', icon: '💪' },
  { key: 'thigh', label: '大腿围', unit: 'cm', icon: '🦵' },
  { key: 'shoulder', label: '肩宽', unit: 'cm', icon: '👔' },
]

const PERIODS = ['近1月', '近3月', '近6月', '近1年'] as const
const PERIOD_DAYS = [30, 90, 180, 365]

export default function BodyIndex() {
  const persons = useLiveQuery(() => db.bodyPersons.toArray())
  const measurements = useLiveQuery(() => db.bodyMeasurements.toArray())

  const [personId, setPersonId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showRecord, setShowRecord] = useState(false)
  const [chartType, setChartType] = useState('weight')
  const [periodIdx, setPeriodIdx] = useState(1) // 近3月
  const [newPerson, setNewPerson] = useState('')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10))
  const [recordValues, setRecordValues] = useState<Record<string, string>>({})

  // Init default person
  useEffect(() => {
    if (persons && persons.length === 0) {
      db.bodyPersons.add({ name: '我', is_default: true, created_at: new Date().toISOString() } as BodyPerson)
    }
    if (persons && persons.length > 0 && personId === null) {
      setPersonId(persons.find(p => p.is_default)?.id || persons[0].id!)
    }
  }, [persons, personId])

  const myMeasurements = useMemo(() => {
    if (!measurements || !personId) return []
    return measurements.filter(m => m.person_id === personId)
  }, [measurements, personId])

  // Latest values per type
  const latest = useMemo(() => {
    const map: Record<string, { value: number; date: string; prev: number | null }> = {}
    for (const t of TYPES) {
      const sorted = myMeasurements.filter(m => m.type === t.key).sort((a, b) => b.date.localeCompare(a.date))
      if (sorted.length > 0) {
        map[t.key] = { value: sorted[0].value, date: sorted[0].date, prev: sorted.length > 1 ? sorted[1].value : null }
      }
    }
    return map
  }, [myMeasurements])

  // Chart data
  const chartData = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[periodIdx])
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return myMeasurements
      .filter(m => m.type === chartType && m.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [myMeasurements, chartType, periodIdx])

  const handleAddPerson = async () => {
    if (!newPerson.trim()) return
    await db.bodyPersons.add({ name: newPerson.trim(), is_default: false, created_at: new Date().toISOString() } as BodyPerson)
    setNewPerson('')
    setShowAdd(false)
  }

  const handleSaveRecord = async () => {
    if (!personId) return
    for (const [type, val] of Object.entries(recordValues)) {
      if (!val) continue
      const existing = await db.bodyMeasurements.where('[person_id+date+type]').equals([personId, recordDate, type]).first()
      const t = TYPES.find(t => t.key === type)
      if (existing) {
        await db.bodyMeasurements.update(existing.id!, { value: Number(val) })
      } else {
        await db.bodyMeasurements.add({ person_id: personId, date: recordDate, type, value: Number(val), unit: t?.unit || 'cm' } as BodyMeasurement)
      }
    }
    setRecordValues({})
    setShowRecord(false)
  }

  if (!persons || !measurements) return null

  // BMI
  const bmi = latest.weight && latest.height ? (latest.weight.value / ((latest.height.value / 100) ** 2)).toFixed(1) : null

  // SVG chart
  const chartMin = chartData.length > 0 ? Math.min(...chartData.map(d => d.value)) : 0
  const chartMax = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 1
  const chartRange = chartMax - chartMin || 1
  const chartW = 320
  const chartH = 100
  const points = chartData.map((d, i) => {
    const x = chartData.length > 1 ? (i / (chartData.length - 1)) * chartW : chartW / 2
    const y = chartH - ((d.value - chartMin) / chartRange) * (chartH - 20) - 10
    return { x, y, value: d.value, date: d.date }
  })

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">身体档案</h1>
          <button onClick={() => setShowRecord(true)} className="text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 rounded-full font-medium">+ 记录</button>
        </div>
      </div>

      <div className="p-4">
        {/* Person selector */}
        <div className="flex gap-2 mb-3">
          {persons.map(p => (
            <button key={p.id} onClick={() => setPersonId(p.id!)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${personId === p.id ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-[#141416] text-gray-500 border border-gray-200 dark:border-white/[0.06]'}`}>
              {p.name}
            </button>
          ))}
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 rounded-full text-xs text-gray-400 border border-dashed border-gray-300 dark:border-gray-700">+ 新增</button>
        </div>

        {/* Overview card */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4 mb-3">
          <p className="text-xs text-gray-400 mb-3">最新数据</p>
          <div className="grid grid-cols-3 gap-3">
            {latest.weight && (
              <div className="text-center">
                <p className="text-xl font-bold text-gray-800 dark:text-white">{latest.weight.value}<span className="text-xs text-gray-400 font-normal">kg</span></p>
                <p className="text-[10px] text-gray-400">体重</p>
                {latest.weight.prev !== null && (
                  <p className={`text-[10px] font-medium ${latest.weight.value < latest.weight.prev ? 'text-green-500' : latest.weight.value > latest.weight.prev ? 'text-red-500' : 'text-gray-400'}`}>
                    {latest.weight.value < latest.weight.prev ? '↓' : latest.weight.value > latest.weight.prev ? '↑' : '—'} {Math.abs(latest.weight.value - latest.weight.prev).toFixed(1)}
                  </p>
                )}
              </div>
            )}
            {latest.height && (
              <div className="text-center">
                <p className="text-xl font-bold text-gray-800 dark:text-white">{latest.height.value}<span className="text-xs text-gray-400 font-normal">cm</span></p>
                <p className="text-[10px] text-gray-400">身高</p>
              </div>
            )}
            {bmi && (
              <div className="text-center">
                <p className="text-xl font-bold text-gray-800 dark:text-white">{bmi}</p>
                <p className="text-[10px] text-gray-400">BMI</p>
              </div>
            )}
          </div>
        </div>

        {/* Trend chart */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">变化趋势</span>
            <button onClick={() => setPeriodIdx((periodIdx + 1) % PERIODS.length)} className="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded">
              {PERIODS[periodIdx]} ▾
            </button>
          </div>
          {/* Metric tabs */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            {TYPES.filter(t => latest[t.key]).map(t => (
              <button key={t.key} onClick={() => setChartType(t.key)} className={`px-2.5 py-1 rounded-full text-[10px] whitespace-nowrap ${chartType === t.key ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {/* SVG */}
          {points.length >= 2 ? (
            <svg viewBox={`0 0 ${chartW} ${chartH + 10}`} className="w-full h-24">
              <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill="#6366f1" />
                  {(i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)) && (
                    <text x={p.x} y={p.y - 8} fontSize="8" fill="#666" textAnchor="middle">{p.value}</text>
                  )}
                </g>
              ))}
            </svg>
          ) : (
            <p className="text-center text-xs text-gray-400 py-6">数据不足，至少需要 2 次记录</p>
          )}
        </div>

        {/* All measurements */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4 mb-3">
          <p className="text-xs text-gray-400 mb-3">各部位尺寸</p>
          <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {TYPES.filter(t => latest[t.key]).map(t => {
              const data = latest[t.key]!
              const change = data.prev !== null ? data.value - data.prev : null
              return (
                <div key={t.key} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{t.icon}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-200">{t.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{data.value} {t.unit}</span>
                    {change !== null && change !== 0 && (
                      <span className={`text-[10px] ml-1.5 ${change < 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {change > 0 ? '↑' : '↓'}{Math.abs(change).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Last record date */}
        {myMeasurements.length > 0 && (
          <p className="text-center text-[11px] text-gray-400">
            上次记录：{myMeasurements.sort((a, b) => b.date.localeCompare(a.date))[0].date}
          </p>
        )}
      </div>

      {/* Add person modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-[390px] rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">新增成员</p>
            <input value={newPerson} onChange={e => setNewPerson(e.target.value)} placeholder="姓名" autoFocus className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">取消</button>
              <button onClick={handleAddPerson} className="flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* Record modal */}
      {showRecord && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" onClick={() => setShowRecord(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-[390px] rounded-t-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">记录数据</p>
            <input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200" />
            {TYPES.map(t => (
              <div key={t.key} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-14">{t.label}</span>
                <input
                  type="number"
                  step="0.1"
                  value={recordValues[t.key] || ''}
                  onChange={e => setRecordValues(v => ({ ...v, [t.key]: e.target.value }))}
                  placeholder={latest[t.key] ? String(latest[t.key]!.value) : '—'}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200"
                />
                <span className="text-[10px] text-gray-400 w-6">{t.unit}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowRecord(false)} className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">取消</button>
              <button onClick={handleSaveRecord} className="flex-1 py-2.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
