import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Crown, CreditCard, Plus } from 'lucide-react'
import { db, type Account } from '../../lib/db'

export default function CreditCards() {
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    db.accounts.filter(a => a.type === 'credit').toArray().then(setAccounts)
  }, [])

  const cardsWithDays = useMemo(() => {
    const today = new Date()
    const dayOfMonth = today.getDate()

    return accounts.filter(a => a.billing_day && a.payment_day).map(card => {
      const billingDay = card.billing_day!
      const paymentDay = card.payment_day!

      // Interest-free days for a purchase made today
      let interestFreeDays: number
      if (dayOfMonth > billingDay) {
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        interestFreeDays = (daysInMonth - dayOfMonth + billingDay) + (paymentDay > billingDay ? paymentDay - billingDay : 30 - billingDay + paymentDay)
      } else {
        interestFreeDays = paymentDay >= dayOfMonth ? paymentDay - dayOfMonth : 30 - dayOfMonth + paymentDay
      }

      // Days until next payment
      let daysUntilPayment: number
      if (dayOfMonth <= paymentDay) {
        daysUntilPayment = paymentDay - dayOfMonth
      } else {
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        daysUntilPayment = daysInMonth - dayOfMonth + paymentDay
      }

      return { ...card, interestFreeDays, daysUntilPayment }
    }).sort((a, b) => b.interestFreeDays - a.interestFreeDays)
  }, [accounts])

  const bestCard = cardsWithDays[0]

  return (
    <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">信用卡管理</h1>
      </div>

      {/* Best Card Highlight */}
      {bestCard && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">今日最优刷卡推荐</p>
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-white">{bestCard.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            免息 <span className="text-amber-600 font-bold text-lg">{bestCard.interestFreeDays}</span> 天 · 还款日还有 {bestCard.daysUntilPayment} 天
          </p>
          <p className="text-xs text-gray-400 mt-2">账单日 {bestCard.billing_day}号 · 还款日 {bestCard.payment_day}号</p>
        </div>
      )}

      {/* All Cards */}
      <div className="space-y-3">
        {cardsWithDays.map(card => (
          <div key={card.id} className="bg-white dark:bg-[#141416] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{card.name}</p>
                  <p className="text-xs text-gray-400">账单日 {card.billing_day}号 · 还款日 {card.payment_day}号</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${card.interestFreeDays > 40 ? 'text-green-500' : card.interestFreeDays > 20 ? 'text-amber-500' : 'text-red-500'}`}>
                  {card.interestFreeDays}天
                </p>
                <p className="text-[10px] text-gray-400">免息期</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50 dark:border-white/[0.06] flex justify-between text-xs text-gray-400">
              <span>额度: ¥{card.credit_limit?.toLocaleString() || '未设置'}</span>
              <span>已用: ¥{Math.abs(card.balance).toLocaleString()}</span>
              <span>还款倒计时: {card.daysUntilPayment}天</span>
            </div>
          </div>
        ))}
      </div>

      {accounts.filter(a => !a.billing_day || !a.payment_day).length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            有 {accounts.filter(a => !a.billing_day || !a.payment_day).length} 张信用卡未设置账单日/还款日，请在账户管理中完善信息。
          </p>
        </div>
      )}

      {cardsWithDays.length === 0 && (
        <div className="text-center py-16">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm mb-4">暂无信用卡</p>
          <Link to="/accounting/accounts" className="inline-flex items-center gap-1 text-sm text-amber-500">
            <Plus className="w-4 h-4" /> 添加信用卡账户
          </Link>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">
        免息天数 = 从今天消费到还款日的天数<br/>账单日后消费可享最长免息期
      </p>
    </main>
  )
}