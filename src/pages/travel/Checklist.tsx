import { useState, useEffect } from 'react'
import { db, type TravelChecklist } from '../../lib/db'
import { useModal } from '../../components/Modal'

interface Props {
  checklistId: number
  onBack: () => void
}

export default function Checklist({ checklistId, onBack }: Props) {
  const [checklist, setChecklist] = useState<TravelChecklist | null>(null)
  const [editMode, setEditMode] = useState(false)
  const { showConfirm, showPrompt } = useModal()

  useEffect(() => { loadChecklist() }, [checklistId])

  async function loadChecklist() {
    const cl = await db.travelChecklists.get(checklistId)
    setChecklist(cl || null)
  }

  async function saveCategories(categories: TravelChecklist['categories']) {
    setChecklist(prev => prev ? { ...prev, categories } : null)
    await db.travelChecklists.update(checklistId, { categories })
  }

  async function toggleItem(catIndex: number, itemIndex: number) {
    if (!checklist) return
    const updated = checklist.categories.map((cat, ci) =>
      ci === catIndex ? {
        ...cat,
        items: cat.items.map((item, ii) =>
          ii === itemIndex ? { ...item, checked: !item.checked } : item
        ),
      } : cat
    )
    await saveCategories(updated)
  }

  // ===== Category CRUD =====
  async function addCategory() {
    const name = await showPrompt('新增分类', { placeholder: '分类名称' })
    if (!name?.trim() || !checklist) return
    const icon = await showPrompt('分类图标', { placeholder: '输入一个 emoji', defaultValue: '📦' }) || '📦'
    const updated = [...checklist.categories, { name: name.trim(), icon, items: [] }]
    await saveCategories(updated)
  }

  async function editCategory(catIndex: number) {
    if (!checklist) return
    const cat = checklist.categories[catIndex]
    const name = await showPrompt('编辑分类名称', { placeholder: '分类名称', defaultValue: cat.name })
    if (!name?.trim()) return
    const icon = await showPrompt('分类图标', { placeholder: 'emoji', defaultValue: cat.icon })
    const updated = checklist.categories.map((c, i) =>
      i === catIndex ? { ...c, name: name.trim(), icon: icon || c.icon } : c
    )
    await saveCategories(updated)
  }

  async function deleteCategory(catIndex: number) {
    if (!checklist) return
    const cat = checklist.categories[catIndex]
    const ok = await showConfirm('删除分类', `删除「${cat.name}」及其所有物品？`)
    if (!ok) return
    const updated = checklist.categories.filter((_, i) => i !== catIndex)
    await saveCategories(updated)
  }

  // ===== Item CRUD =====
  async function addItem(catIndex: number) {
    if (!checklist) return
    const text = await showPrompt('添加物品', { placeholder: '物品名称' })
    if (!text?.trim()) return
    const updated = checklist.categories.map((cat, ci) =>
      ci === catIndex ? { ...cat, items: [...cat.items, { text: text.trim(), checked: false }] } : cat
    )
    await saveCategories(updated)
  }

  async function editItem(catIndex: number, itemIndex: number) {
    if (!checklist) return
    const item = checklist.categories[catIndex].items[itemIndex]
    const text = await showPrompt('编辑物品', { placeholder: '物品名称', defaultValue: item.text })
    if (!text?.trim()) return
    const updated = checklist.categories.map((cat, ci) =>
      ci === catIndex ? {
        ...cat,
        items: cat.items.map((it, ii) => ii === itemIndex ? { ...it, text: text.trim() } : it),
      } : cat
    )
    await saveCategories(updated)
  }

  async function deleteItem(catIndex: number, itemIndex: number) {
    if (!checklist) return
    const updated = checklist.categories.map((cat, ci) =>
      ci === catIndex ? { ...cat, items: cat.items.filter((_, ii) => ii !== itemIndex) } : cat
    )
    await saveCategories(updated)
  }

  // ===== Batch actions =====
  async function resetAll() {
    if (!checklist) return
    const ok = await showConfirm('重置', '重置所有打勾状态？')
    if (!ok) return
    const updated = checklist.categories.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({ ...item, checked: false })),
    }))
    await saveCategories(updated)
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
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">{checklist.icon} {checklist.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditMode(!editMode)} className={`text-xs px-2 py-1 rounded ${editMode ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'text-gray-400 hover:text-amber-500'}`}>
            {editMode ? '完成' : '编辑'}
          </button>
          <span className="text-sm text-gray-500">{checked}/{total}</span>
        </div>
      </div>

      {/* Progress card - gradient */}
      <div className="rounded-xl p-4 mb-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #002e1a, #003d23, #004d2d)' }}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] text-emerald-300/50">进度</p>
            <p className="text-lg font-bold text-white mt-0.5">{checked}/{total} 项</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-400">{pct.toFixed(0)}%</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-white/10 rounded-full">
          <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-400' : 'bg-emerald-500/60'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {pct === 100 && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center mb-4">全部打包完成!</p>}

      {/* Categories */}
      <div className="space-y-4">
        {checklist.categories.map((cat, catIndex) => {
          const catChecked = cat.items.filter(i => i.checked).length
          return (
            <div key={catIndex}>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.icon} {cat.name}</h3>
                <div className="flex items-center gap-2">
                  {editMode && (
                    <>
                      <button onClick={() => editCategory(catIndex)} className="text-xs text-blue-500 hover:text-blue-600">改名</button>
                      <button onClick={() => deleteCategory(catIndex)} className="text-xs text-red-400 hover:text-red-500">删除</button>
                    </>
                  )}
                  <span className="text-xs text-gray-400">{catChecked}/{cat.items.length}</span>
                </div>
              </div>
              <div className="space-y-2">
                {cat.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-1">
                    <button
                      onClick={() => toggleItem(catIndex, itemIndex)}
                      className={`flex-1 flex items-center gap-3 px-3 py-3 rounded-xl border shadow-sm relative overflow-hidden text-left ${
                        item.checked
                          ? 'bg-white/50 dark:bg-[#141416]/50 border-gray-100 dark:border-white/[0.04] opacity-50'
                          : 'bg-white dark:bg-[#141416] border-gray-100 dark:border-white/[0.06]'
                      }`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${item.checked ? 'bg-emerald-300' : 'bg-gray-200'} dark:hidden`} />
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
                      <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {item.text}
                      </span>
                    </button>
                    {editMode && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => editItem(catIndex, itemIndex)} className="p-1.5 text-gray-300 hover:text-blue-500">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => deleteItem(catIndex, itemIndex)} className="p-1.5 text-gray-300 hover:text-red-500">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {/* Add item button */}
                {editMode && (
                  <button onClick={() => addItem(catIndex)} className="w-full flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-white/[0.08] text-gray-400 hover:text-amber-500 hover:border-amber-300">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                    <span className="text-xs">添加物品</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Add category button */}
        {editMode && (
          <button onClick={addCategory} className="w-full flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-dashed border-gray-300 dark:border-white/[0.1] text-gray-400 hover:text-amber-500 hover:border-amber-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            <span className="text-sm">添加分类</span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button onClick={resetAll} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 dark:border-white/[0.06] rounded-lg">
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
