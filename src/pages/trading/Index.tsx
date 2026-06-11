import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getNotifications } from '../../lib/api'
import { requestNotificationPermission, sendNotification } from '../../lib/notify'
import Analysis from './Analysis'
import Positions from './Positions'
import Orders from './Orders'
import Watchlist from './Watchlist'
import Stats from './Stats'

const tabs = ['分析', '持仓', '条件单', '自选', '统计'] as const
type Tab = typeof tabs[number]

export default function TradingIndex() {
  const [activeTab, setActiveTab] = useState<Tab>('分析')
  const lastNotifyCheck = useRef(new Date().toISOString())

  useEffect(() => {
    requestNotificationPermission()
    // 轮询通知（每 30s 检查一次服务端是否有新通知）
    const interval = setInterval(async () => {
      try {
        const notifications = await getNotifications(lastNotifyCheck.current)
        if (notifications && notifications.length > 0) {
          lastNotifyCheck.current = notifications[0].created_at
          for (const n of notifications) {
            sendNotification(n.title, n.body)
          }
        }
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">ETF 策略助手</h1>
      </div>

      <div className="flex border-b border-gray-200 dark:border-white/[0.06] mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === '分析' && <Analysis />}
      {activeTab === '持仓' && <Positions />}
      {activeTab === '条件单' && <Orders />}
      {activeTab === '自选' && <Watchlist />}
      {activeTab === '统计' && <Stats />}
    </main>
  )
}
