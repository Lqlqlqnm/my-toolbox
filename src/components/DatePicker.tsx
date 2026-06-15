import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  placeholder?: string
  label?: string
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function DatePicker({ value, onChange, placeholder = '选择日期', label }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const today = new Date()
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate())

  // Parse value or default to current month
  const parsed = value ? new Date(value) : today
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value, open])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  function selectDay(day: number) {
    const dateStr = formatDate(viewYear, viewMonth, day)
    onChange(dateStr)
    setOpen(false)
  }

  function selectToday() {
    onChange(todayStr)
    setOpen(false)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)

  const displayValue = value
    ? `${value.slice(0, 4)}年${parseInt(value.slice(5, 7))}月${parseInt(value.slice(8, 10))}日`
    : ''

  return (
    <div className="relative" ref={ref}>
      {label && <label className="text-xs text-gray-400 block mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-left outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
      >
        {displayValue || <span className="text-gray-400">{placeholder}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="bg-white dark:bg-[#1a1a1a] w-full max-w-lg rounded-t-2xl p-5 pb-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <ChevronLeft size={18} />
              </button>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                {viewYear}年{viewMonth + 1}月
              </h3>
              <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-[11px] text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = formatDate(viewYear, viewMonth, day)
                const isSelected = dateStr === value
                const isToday = dateStr === todayStr

                return (
                  <button
                    key={day}
                    onClick={() => selectDay(day)}
                    className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-amber-500 text-white'
                        : isToday
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Quick actions */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
              <button
                onClick={selectToday}
                className="text-xs text-amber-500 font-medium"
              >
                今天
              </button>
              {value && (
                <button
                  onClick={() => { onChange(''); setOpen(false) }}
                  className="text-xs text-gray-400"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
