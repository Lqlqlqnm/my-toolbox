import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db, type TravelTemplate, type TravelChecklist } from '../../lib/db'
import { useModal } from '../../components/Modal'
import EditTemplate from './EditTemplate'
import Checklist from './Checklist'

type View = { type: 'list' } | { type: 'edit'; templateId?: number } | { type: 'checklist'; checklistId: number }

export default function TravelIndex() {
  const [templates, setTemplates] = useState<TravelTemplate[]>([])
  const [activeChecklists, setActiveChecklists] = useState<TravelChecklist[]>([])
  const [archivedChecklists, setArchivedChecklists] = useState<TravelChecklist[]>([])
  const [view, setView] = useState<View>({ type: 'list' })
  const [showHistory, setShowHistory] = useState(false)
  const { showConfirm, showPrompt } = useModal()

  useEffect(() => { loadData() }, [view])

  async function loadData() {
    const t = await db.travelTemplates.toArray()
    setTemplates(t)
    const all = await db.travelChecklists.toArray()
    setActiveChecklists(all.filter(c => !c.is_archived))
    setArchivedChecklists(all.filter(c => c.is_archived))
  }

  async function createChecklist(template: TravelTemplate) {
    const name = await showPrompt('行程名称', { defaultValue: `${template.name} - ${new Date().toLocaleDateString()}` })
    if (!name) return
    const tripDate = await showPrompt('出发日期', { defaultValue: new Date().toISOString().split('T')[0], placeholder: '如 2026-06-15', inputType: 'date' })

    const id = await db.travelChecklists.add({
      template_id: template.id!,
      name,
      icon: template.icon,
      categories: template.categories.map(cat => ({
        name: cat.name,
        icon: cat.icon,
        items: cat.items.map(text => ({ text, checked: false })),
      })),
      trip_date: tripDate || null,
      is_archived: false,
      created_at: new Date().toISOString(),
    })
    setView({ type: 'checklist', checklistId: id as number })
  }

  async function deleteTemplate(id: number) {
    const ok = await showConfirm('删除模板', '确定删除此模板？')
    if (!ok) return
    await db.travelTemplates.delete(id)
    await loadData()
  }

  if (view.type === 'edit') {
    return <EditTemplate templateId={view.templateId} onBack={() => setView({ type: 'list' })} />
  }

  if (view.type === 'checklist') {
    return <Checklist checklistId={view.checklistId} onBack={() => setView({ type: 'list' })} />
  }

  const totalItems = (t: TravelTemplate) => t.categories.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">旅行清单</h1>
      </div>

      {/* 进行中的行程 */}
      {activeChecklists.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">进行中</h2>
          <div className="space-y-2">
            {activeChecklists.map(cl => {
              const total = cl.categories.reduce((s, c) => s + c.items.length, 0)
              const checked = cl.categories.reduce((s, c) => s + c.items.filter(i => i.checked).length, 0)
              const pct = total > 0 ? (checked / total) * 100 : 0
              return (
                <button key={cl.id} onClick={() => setView({ type: 'checklist', checklistId: cl.id! })}
                  className="w-full p-3 bg-white dark:bg-[#141416] rounded-lg border border-gray-100 dark:border-white/[0.06] text-left">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{cl.icon} {cl.name}</span>
                    <span className="text-xs text-gray-400">{checked}/{total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {cl.trip_date && <p className="text-xs text-gray-400 mt-1">{cl.trip_date} 出发</p>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 模板列表 */}
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">我的模板</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {templates.map(t => (
          <div key={t.id} className="p-3 bg-white dark:bg-[#141416] rounded-lg border border-gray-100 dark:border-white/[0.06]">
            <div className="text-2xl mb-1">{t.icon}</div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.name}</p>
            <p className="text-xs text-gray-400">{totalItems(t)} 项</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => createChecklist(t)} className="text-xs text-emerald-600 hover:text-emerald-700">使用</button>
              <button onClick={() => setView({ type: 'edit', templateId: t.id })} className="text-xs text-blue-500 hover:text-blue-600">编辑</button>
              <button onClick={() => deleteTemplate(t.id!)} className="text-xs text-gray-400 hover:text-red-500">删除</button>
            </div>
          </div>
        ))}
        <button onClick={() => setView({ type: 'edit' })}
          className="p-3 bg-[#f4f4f5] dark:bg-[#0c0c0d] rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center">
          <span className="text-2xl text-gray-300">+</span>
          <span className="text-xs text-gray-400 mt-1">新建模板</span>
        </button>
      </div>

      {/* 历史行程 */}
      {archivedChecklists.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-gray-500 hover:text-gray-700">
            {showHistory ? '收起历史' : `历史行程 (${archivedChecklists.length})`}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {archivedChecklists.map(cl => (
                <button key={cl.id} onClick={() => setView({ type: 'checklist', checklistId: cl.id! })}
                  className="w-full p-2 bg-[#f4f4f5] dark:bg-[#0c0c0d] rounded text-left text-xs">
                  <span className="text-gray-700 dark:text-gray-300">{cl.icon} {cl.name}</span>
                  <span className="text-gray-400 ml-2">{cl.trip_date}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
