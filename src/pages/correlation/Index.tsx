import { useState } from 'react'
import { Link, Routes, Route } from 'react-router-dom'
import DailyInput from './DailyInput'
import Results from './Results'
import Variables from './Variables'

const tabs = [
  { key: 'input', label: '记录', path: '' },
  { key: 'results', label: '发现', path: 'results' },
  { key: 'variables', label: '变量', path: 'variables' },
] as const

export default function CorrelationIndex() {
  const path = location.pathname
  const activeTab = path.includes('/results') ? 'results' : path.includes('/variables') ? 'variables' : 'input'

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="text-gray-400 hover:text-gray-600 dark:text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">相关性发现器</h1>
          <div className="w-5" />
        </div>
        {/* Tabs */}
        <div className="flex px-4 gap-1">
          {tabs.map(tab => (
            <Link
              key={tab.key}
              to={`/correlation/${tab.path}`}
              className={`flex-1 text-center py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <Routes>
        <Route path="/" element={<DailyInput />} />
        <Route path="/results" element={<Results />} />
        <Route path="/variables" element={<Variables />} />
      </Routes>
    </div>
  )
}
