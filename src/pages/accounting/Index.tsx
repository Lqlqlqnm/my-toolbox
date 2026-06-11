import { Routes, Route, useLocation, Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Overview from './Overview'
import TransactionList from './TransactionList'
import Dashboard from './Dashboard'
import AddTransaction from './AddTransaction'
import Stats from './Stats'
import Accounts from './Accounts'
import Budgets from './Budgets'
import Recurring from './Recurring'
import Debts from './Debts'
import SavingsGoals from './SavingsGoals'
import Books from './Books'
import Categories from './Categories'
import DataIO from './DataIO'
import AssetTrend from './AssetTrend'
import Tools from './Tools'
import CreditCards from './CreditCards'
import Templates from './Templates'

const tabs = [
  { path: '/accounting', label: '首页' },
  { path: '/accounting/list', label: '流水' },
  { path: '/accounting/stats', label: '统计' },
  { path: '/accounting/accounts', label: '资产' },
  { path: '/accounting/tools', label: '工具' },
]

export default function AccountingIndex() {
  const location = useLocation()

  // Pages that show the tab bar (main views)
  const showTabs = ['/accounting', '/accounting/list', '/accounting/stats', '/accounting/accounts', '/accounting/tools'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d] flex flex-col max-w-lg mx-auto">
      {/* Top Tab Bar */}
      {showTabs && (
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#141416]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <Link to="/" className="text-gray-400 dark:text-gray-500 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">记账本</h1>
            <span className="w-5" />
          </div>
          <div className="flex">
            {tabs.map(tab => {
              const isActive = location.pathname === tab.path
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${isActive ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-400 dark:text-gray-500'}`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/list" element={<TransactionList />} />
          <Route path="/add" element={<AddTransaction />} />
          <Route path="/edit/:id" element={<AddTransaction />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/savings" element={<SavingsGoals />} />
          <Route path="/books" element={<Books />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/data" element={<DataIO />} />
          <Route path="/trend" element={<AssetTrend />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/credit-cards" element={<CreditCards />} />
        </Routes>
      </div>

      {/* FAB */}
      {showTabs && (
        <Link
          to="/accounting/add"
          className="fixed bottom-6 right-5 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-colors"
        >
          <Plus className="w-6 h-6" />
        </Link>
      )}
    </div>
  )
}
