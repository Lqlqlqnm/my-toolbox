import { Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { initDefaultData, initTravelTemplates, processPendingInstallments } from './lib/db'
import { shouldRemindBackup, shareBackup } from './lib/backup'
import { initTheme } from './lib/theme'
import Home from './pages/Home'
import Accounting from './pages/accounting/Index'
import Trading from './pages/trading/Index'
import Travel from './pages/travel/Index'
import Settings from './pages/Settings'

export default function App() {
  const [showBackupReminder, setShowBackupReminder] = useState(false)

  useEffect(() => {
    initDefaultData()
    initTravelTemplates()
    initTheme()
    processPendingInstallments()
    if (shouldRemindBackup()) setShowBackupReminder(true)
  }, [])

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d] transition-colors">
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
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  )
}
