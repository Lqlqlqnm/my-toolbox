import { useState, useEffect } from 'react'
import { db, type TravelChecklist } from '../../lib/db'
import { useModal } from '../../components/Modal'

interface Props {
  checklistId: number
  onBack: () => void
}

export default function Checklist({ checklistId, onBack }: Props) {
  const [checklist, setChecklist] = useState<TravelChecklist | null>(null)
  const { showConfirm } = useModal()

  useEffect(() => { loadChecklist() }, [checklistId])

  async function loadChecklist() {
    const cl = await db.travelChecklists.get(checklistId)
    setChecklist(cl || null)
  }

  async function toggleItem(catIndex: number, itemIndex: number) {
    if (!checklist) return
    const updated = { ...checklist }
    updated.categories = [...updated.categories]
    updated.categories[catIndex] = { ...updated.categories[catIndex] }
    updated.categories[catIndex].items = [...updated.categories[catIndex].items]
    updated.categories[catIndex].items[itemIndex] = {
      ...updated.categories[catIndex].items[itemIndex],
      checked: !updated.categories[catIndex].items[itemIndex].checked,
    }
    setChecklist(updated)
    await db.travelChecklists.update(checklistId, { categories: updated.categories })
  }

  async function resetAll() {
    if (!checklist) return
    const ok = await showConfirm('重置', '重置所有打勾状态？')
    if (!ok) return
    const updated = checklist.categories.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({ ...item, checked: false })),
    }))
    setChecklist({ ...checklist, categories: updated })
    await db.travelChecklists.update(checklistId, { categories: updated })
  }

  async function archiveChecklist() {
    const ok = await showConfirm('归档', '归档此行程？')
    if (!ok) return
    await db.travelChecklists.update(checklistId, { is_archived: true })
    onBack()
  }

  async function deleteChecklist() {
    const ok = await showConfirm('删除', '删除此行程？不可恢复')
    if (!ok) return
    await db.travelChecklists.delete(checklistId)
    onBack()
  }

  if (!checklist) return <p className="text-center text-gray-400 py-10">加载中...</p>

  const total = checklist.categories.reduce((s, c) => s + c.items.length, 0)
  const checked = checklist.categories.reduce((s, c) => s + c.items.filter(i => i.checked).length, 0)
  const pct = total > 0 ? (checked / total) * 100 : 0

  return (
    <main className="max-w-lg mx-auto px-4 py-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">{checklist.icon} {checklist.name}</h1>
        </div>
        <span className="text-sm text-gray-500">{checked}/{total}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>
      {pct === 100 && <p className="text-xs text-emerald-600 text-center mb-4">全部打包完成!</p>}

      {/* Categories */}
      <div className="space-y-4">
        {checklist.categories.map((cat, catIndex) => {
          const catChecked = cat.items.filter(i => i.checked).length
          return (
            <div key={catIndex}>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.icon} {cat.name}</h3>
                <span className="text-xs text-gray-400">{catChecked}/{cat.items.length}</span>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                {cat.items.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    onClick={() => toggleItem(catIndex, itemIndex)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.checked
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {item.checked && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button onClick={resetAll} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg">
          全部重置
        </button>
        {!checklist.is_archived && (
          <button onClick={archiveChecklist} className="flex-1 py-2 text-sm text-emerald-600 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            归档
          </button>
        )}
        <button onClick={deleteChecklist} className="flex-1 py-2 text-sm text-red-500 border border-red-200 dark:border-red-800 rounded-lg">
          删除
        </button>
      </div>
    </main>
  )
}
