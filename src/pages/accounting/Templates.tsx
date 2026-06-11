import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getTemplates, deleteTemplate, type QuickTemplate } from '../../lib/accounting-utils'
import { db } from '../../lib/db'

export default function Templates() {
  const [templates, setTemplates] = useState<QuickTemplate[]>([])
  const [categories, setCategories] = useState<Map<number, { name: string; icon: string }>>()
  const [accounts, setAccounts] = useState<Map<number, { name: string; icon: string }>>()
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setTemplates(getTemplates())
    const cats = await db.categories.toArray()
    setCategories(new Map(cats.map(c => [c.id!, { name: c.name, icon: c.icon }])))
    const accts = await db.accounts.toArray()
    setAccounts(new Map(accts.map(a => [a.id!, { name: a.name, icon: a.icon }])))
  }

  function handleDelete(id: string) {
    if (!confirm('删除此模板？')) return
    deleteTemplate(id)
    setTemplates(getTemplates())
  }

  function handleUse(tpl: QuickTemplate) {
    // Navigate to AddTransaction with pre-filled values via URL params
    const params = new URLSearchParams({
      type: tpl.type,
      amount: String(tpl.amount),
      note: tpl.name,
      ...(tpl.category_id ? { category: String(tpl.category_id) } : {}),
      ...(tpl.account_id ? { account: String(tpl.account_id) } : {}),
    })
    navigate(`/accounting/add?${params.toString()}`)
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/accounting" className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">常用模板</h1>
        </div>
        <Link to="/accounting/add" className="text-xs text-amber-500">去记账时保存模板</Link>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm mb-2">暂无模板</p>
          <p className="text-gray-300 text-xs">在记一笔页面底部点击"保存为模板"即可创建</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(tpl => (
            <div key={tpl.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{tpl.category_id && categories?.get(tpl.category_id)?.icon || '📌'}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{tpl.name}</p>
                  <p className="text-xs text-gray-400">
                    {tpl.type === 'expense' ? '支出' : '收入'} ¥{tpl.amount}
                    {tpl.account_id && accounts?.get(tpl.account_id) ? ` · ${accounts.get(tpl.account_id)!.name}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleUse(tpl)} className="px-3 py-1 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded">使用</button>
                <button onClick={() => handleDelete(tpl.id)} className="px-2 py-1 text-xs text-gray-400 hover:text-red-500">删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
