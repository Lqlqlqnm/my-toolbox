import { Link } from 'react-router-dom'

export default function AccountingIndex() {
  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">记账本</h1>
      </div>
      <p className="text-gray-400 text-center py-20">记账模块开发中...</p>
    </main>
  )
}
