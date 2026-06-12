import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { initDefaultData, initTravelTemplates, processPendingInstallments } from './lib/db'
import { shouldRemindBackup, shareBackup } from './lib/backup'
import { initTheme } from './lib/theme'
import Home from './pages/Home'
import Accounting from './pages/accounting/Index'
import Trading from './pages/trading/Index'
import Travel from './pages/travel/Index'
import Settings from './pages/Settings'

const Correlation = lazy(() => import('./pages/correlation/Index'))
const Subscriptions = lazy(() => import('./pages/subscriptions/Index'))
const Storage = lazy(() => import('./pages/storage/Index'))

function usePullToRefresh() {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const threshold = 80

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (window.scrollY > 0 || startY.current === 0) return
    const diff = e.touches[0].clientY - startY.current
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 120))
      if (diff > threshold) setPulling(true)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (pulling) {
      window.location.reload()
    }
    setPullDistance(0)
    setPulling(false)
    startY.current = 0
  }, [pulling])

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd)
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return { pullDistance, pulling }
}

export default function App() {
  const [showBackupReminder, setShowBackupReminder] = useState(false)
  const { pullDistance, pulling } = usePullToRefresh()

  useEffect(() => {
    initDefaultData()
    initTravelTemplates()
    initTheme()
    processPendingInstallments()
    if (shouldRemindBackup()) setShowBackupReminder(true)
  }, [])

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d] transition-colors">
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="fixed top-0 left-0 right-0 flex justify-center z-[60] pointer-events-none" style={{ transform: `translateY(${pullDistance - 40}px)` }}>
          <div className={`w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center ${pulling ? 'animate-spin' : ''}`}>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}
      {/* Backup Reminder Banner */}
      {showBackupReminder && (
        <div className="fixed top-0 left-0 right-0 bg-[#141416] dark:bg-[#141416] text-white text-center py-2.5 px-4 text-sm z-50 flex items-center justify-center gap-3 border-b border-white/[0.06]">
          <span className="text-gray-300 text-xs">已超过 7 天未备份数据</span>
          <button
            onClick={async () => { await shareBackup(); setShowBackupReminder(false) }}
            className="px-3 py-0.5 bg-amber-500 text-white rounded text-xs font-medium"
          >
            立即备份
          </button>
          <button onClick={() => setShowBackupReminder(false)} className="text-gray-500 text-xs">忽略</button>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/accounting/*" element={<Accounting />} />
        <Route path="/trading/*" element={<Trading />} />
        <Route path="/travel/*" element={<Travel />} />
        <Route path="/correlation/*" element={<Suspense fallback={<div />}><Correlation /></Suspense>} />
        <Route path="/subscriptions/*" element={<Suspense fallback={<div />}><Subscriptions /></Suspense>} />
        <Route path="/storage/*" element={<Suspense fallback={<div />}><Storage /></Suspense>} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  )
}
