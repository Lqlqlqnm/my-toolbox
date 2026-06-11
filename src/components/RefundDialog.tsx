import { useState } from 'react'
import type { Account } from '../lib/db'

interface Props {
  originalAmount: number
  accounts: Account[]
  defaultAccountId: number | null
  onConfirm: (amount: number, date: string, accountId: number | null) => void
  onCancel: () => void
}

export default function RefundDialog({ originalAmount, accounts, defaultAccountId, onConfirm, onCancel }: Props) {
  const [amount, setAmount] = useState(String(originalAmount))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState<number | null>(defaultAccountId)

  function handleConfirm() {
    const num = parseFloat(amount)
    if (!num || num <= 0 || num > originalAmount) return
    onConfirm(num, date, accountId)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">退款</h3>

        <div className="space-y-3">
          {/* 金额 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">退款金额（原金额 ¥{originalAmount}）</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              step="0.01"
              max={originalAmount}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm outline-none focus:border-amber-400"
            />
          </div>

          {/* 日期 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">退款日期</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm outline-none focus:border-amber-400"
            />
          </div>

          {/* 退入账户 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">退入账户</label>
            <div className="flex flex-wrap gap-2">
              {accounts.map(a => (
                <button
                  key={a.id}
                  onClick={() => setAccountId(a.id!)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    accountId === a.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700">
            取消
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600">
            确认退款
          </button>
        </div>
      </div>
    </div>
  )
}
