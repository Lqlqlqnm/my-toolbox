import { useState, useEffect, useMemo } from 'react'
import { db, type CorrelationVariable, type CorrelationRecord } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatDisplay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function getWeekday(date: Date): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
}

export default function DailyInput() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const dateStr = formatDate(currentDate)

  const variables = useLiveQuery(() =>
    db.correlationVariables.filter(v => v.is_active).sortBy('sort_order')
  )

  const records = useLiveQuery(
    () => db.correlationRecords.where('date').equals(dateStr).toArray(),
    [dateStr]
  )

  const note = useLiveQuery(
    () => db.correlationNotes.where('date').equals(dateStr).first(),
    [dateStr]
  )

  // Local state for editing
  const [values, setValues] = useState<Record<number, number | null>>({})
  const [noteText, setNoteText] = useState('')
  const [saved, setSaved] = useState(false)

  // Sync from DB when records load
  useEffect(() => {
    if (records) {
      const map: Record<number, number | null> = {}
      records.forEach(r => { map[r.variable_id] = r.value })
      setValues(map)
    }
  }, [records])

  useEffect(() => {
    setNoteText(note?.note || '')
  }, [note])

  const setValue = (varId: number, val: number | null) => {
    setValues(prev => ({ ...prev, [varId]: val }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!variables) return

    // Save all values
    for (const v of variables) {
      const val = values[v.id!]
      if (val === null || val === undefined) {
        // Remove if exists
        await db.correlationRecords.where('[date+variable_id]').equals([dateStr, v.id!]).delete()
      } else {
        const existing = await db.correlationRecords.where('[date+variable_id]').equals([dateStr, v.id!]).first()
        if (existing) {
          await db.correlationRecords.update(existing.id!, { value: val })
        } else {
          await db.correlationRecords.add({ date: dateStr, variable_id: v.id!, value: val })
        }
      }
    }

    // Save note
    if (noteText.trim()) {
      const existingNote = await db.correlationNotes.where('date').equals(dateStr).first()
      if (existingNote) {
        await db.correlationNotes.update(existingNote.id!, { note: noteText.trim() })
      } else {
        await db.correlationNotes.add({ date: dateStr, note: noteText.trim() })
      }
    } else {
      await db.correlationNotes.where('date').equals(dateStr).delete()
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const prevDay = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 1)
    setCurrentDate(d)
  }

  const nextDay = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 1)
    if (d <= new Date()) setCurrentDate(d)
  }

  const isToday = formatDate(currentDate) === formatDate(new Date())

  // Group variables by type
  const grouped = useMemo(() => {
    if (!variables) return { rating: [], number: [], boolean: [], category: [] }
    return {
      rating: variables.filter(v => v.type === 'rating'),
      number: variables.filter(v => v.type === 'number'),
      boolean: variables.filter(v => v.type === 'boolean'),
      category: variables.filter(v => v.type === 'category'),
    }
  }, [variables])

  // Progress
  const filledCount = variables ? variables.filter(v => values[v.id!] !== null && values[v.id!] !== undefined).length : 0
  const totalCount = variables?.length || 0

  // Streak calculation
  const [streak, setStreak] = useState(0)
  useEffect(() => {
    async function calcStreak() {
      let count = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const ds = formatDate(d)
        const recs = await db.correlationRecords.where('date').equals(ds).count()
        if (recs > 0) count++
        else break
      }
      setStreak(count)
    }
    calcStreak()
  }, [dateStr, records])

  if (!variables) return null

  return (
    <div className="pb-24">
      {/* Date nav */}
      <div className="flex items-center justify-center gap-4 py-3">
        <button onClick={prevDay} className="p-1 text-gray-400"><ChevronLeft size={20} /></button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {formatDisplay(currentDate)} {getWeekday(currentDate)}
          {isToday && <span className="ml-1 text-xs text-green-500">今天</span>}
        </span>
        <button onClick={nextDay} className={`p-1 ${isToday ? 'text-gray-200 dark:text-gray-700' : 'text-gray-400'}`} disabled={isToday}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Rating section */}
      {grouped.rating.length > 0 && (
        <Section title="状态评分">
          {grouped.rating.map(v => (
            <RatingRow key={v.id} variable={v} value={values[v.id!] ?? null} onChange={val => setValue(v.id!, val)} />
          ))}
        </Section>
      )}

      {/* Number section */}
      {grouped.number.length > 0 && (
        <Section title="数值记录">
          {grouped.number.map(v => (
            <NumberRow key={v.id} variable={v} value={values[v.id!] ?? null} onChange={val => setValue(v.id!, val)} />
          ))}
        </Section>
      )}

      {/* Boolean section */}
      {grouped.boolean.length > 0 && (
        <Section title="是 / 否">
          {grouped.boolean.map(v => (
            <BooleanRow key={v.id} variable={v} value={values[v.id!] ?? null} onChange={val => setValue(v.id!, val)} />
          ))}
        </Section>
      )}

      {/* Category section */}
      {grouped.category.length > 0 && (
        <Section title="分类">
          {grouped.category.map(v => (
            <CategoryRow key={v.id} variable={v} value={values[v.id!] ?? null} onChange={val => setValue(v.id!, val)} />
          ))}
        </Section>
      )}

      {/* Note */}
      <div className="mx-4 mb-3">
        <div className="bg-white dark:bg-[#141416] rounded-xl p-4">
          <textarea
            value={noteText}
            onChange={e => { setNoteText(e.target.value); setSaved(false) }}
            placeholder="一句话备注（可选）"
            className="w-full border border-gray-100 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm resize-none h-10 outline-none focus:border-indigo-400 bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600"
          />
        </div>
      </div>

      {/* Progress */}
      <div className="mx-4 mb-4">
        <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${totalCount > 0 ? (filledCount / totalCount) * 100 : 0}%` }} />
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          已记录 {filledCount}/{totalCount} 项 · 连续记录 {streak} 天
        </p>
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] p-4 pb-7 bg-gradient-to-t from-[#f4f4f5] dark:from-[#0c0c0d] via-[#f4f4f5] dark:via-[#0c0c0d] to-transparent">
        <button
          onClick={handleSave}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            saved ? 'bg-green-500 text-white' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
          }`}
        >
          <Save size={16} />
          {saved ? '已保存' : '保存今天'}
        </button>
      </div>
    </div>
  )
}

// ===== Sub-components =====

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-3">
      <div className="bg-white dark:bg-[#141416] rounded-xl p-4">
        <p className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wider">{title}</p>
        <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">{children}</div>
      </div>
    </div>
  )
}

function RatingRow({ variable, value, onChange }: { variable: CorrelationVariable; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-700 dark:text-gray-200">{variable.name}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(value === n ? null : n)}
            className={`w-7 h-7 rounded-full border-2 text-xs font-medium flex items-center justify-center transition-colors ${
              value === n
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-400'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberRow({ variable, value, onChange }: { variable: CorrelationVariable; value: number | null; onChange: (v: number | null) => void }) {
  const step = variable.step || 1
  const min = variable.min || 0
  const max = variable.max || 99

  const increment = () => {
    const current = value ?? min
    const next = Math.min(current + step, max)
    onChange(next)
  }

  const decrement = () => {
    const current = value ?? min
    const next = current - step
    onChange(next <= min ? null : next)
  }

  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-700 dark:text-gray-200">{variable.name}</span>
      <div className="flex items-center gap-2">
        <button onClick={decrement} className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 text-sm">−</button>
        <span className="w-10 text-center text-sm font-semibold text-gray-800 dark:text-gray-100">
          {value !== null && value !== undefined ? value : '—'}
        </span>
        <button onClick={increment} className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 text-sm">+</button>
        {variable.unit && <span className="text-xs text-gray-400 ml-0.5">{variable.unit}</span>}
      </div>
    </div>
  )
}

function BooleanRow({ variable, value, onChange }: { variable: CorrelationVariable; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-700 dark:text-gray-200">{variable.name}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(value === 1 ? null : 1)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            value === 1
              ? 'border-green-400 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-400'
          }`}
        >
          是
        </button>
        <button
          onClick={() => onChange(value === 0 ? null : 0)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            value === 0
              ? 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-400'
          }`}
        >
          否
        </button>
      </div>
    </div>
  )
}

function CategoryRow({ variable, value, onChange }: { variable: CorrelationVariable; value: number | null; onChange: (v: number | null) => void }) {
  const options = variable.options || []
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-700 dark:text-gray-200">{variable.name}</span>
      <div className="flex gap-1.5">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onChange(value === idx ? null : idx)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              value === idx
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
