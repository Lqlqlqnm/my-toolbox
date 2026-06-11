import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db, type Category } from '../../lib/db'
import CategoryIcon, { categoryIconKeys } from '../../components/CategoryIcon'

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', icon: 'pin', parent_id: null as number | null })
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cats = await db.categories.orderBy('sort_order').toArray()
    setCategories(cats)
  }

  const filtered = categories.filter(c => c.type === viewType)
  const topLevel = filtered.filter(c => !c.parent_id)
  const childrenOf = (parentId: number) => filtered.filter(c => c.parent_id === parentId)

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openAdd(parentId: number | null = null) {
    setForm({ name: '', icon: 'pin', parent_id: parentId })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(c: Category) {
    setForm({ name: c.name, icon: c.icon, parent_id: c.parent_id })
    setEditingId(c.id!)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    if (editingId) {
      await db.categories.update(editingId, { name: form.name, icon: form.icon, parent_id: form.parent_id })
    } else {
      const maxOrder = filtered.length > 0 ? Math.max(...filtered.map(c => c.sort_order)) : 0
      await db.categories.add({
        name: form.name,
        icon: form.icon,
        type: viewType,
        parent_id: form.parent_id,
        sort_order: maxOrder + 1,
      })
    }
    setShowForm(false)
    loadData()
  }

  async function deleteCategory(id: number) {
    const txCount = await db.transactions.where('category_id').equals(id).count()
    if (txCount > 0) {
      if (!confirm(`此分类下有 ${txCount} 条记录，删除后记录将变为"未分类"，确定？`)) return
      await db.transactions.where('category_id').equals(id).modify({ category_id: null })
    }
    await db.categories.delete(id)
    loadData()
  }

  async function moveUp(c: Category, idx: number) {
    if (idx === 0) return
    const prev = topLevel[idx - 1]
    await db.categories.update(c.id!, { sort_order: prev.sort_order })
    await db.categories.update(prev.id!, { sort_order: c.sort_order })
    loadData()
  }

  async function moveDown(c: Category, idx: number) {
    if (idx === topLevel.length - 1) return
    const next = topLevel[idx + 1]
    await db.categories.update(c.id!, { sort_order: next.sort_order })
    await db.categories.update(next.id!, { sort_order: c.sort_order })
    loadData()
  }

  const iconOptions = categoryIconKeys

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">分类管理</h1>
        <button onClick={() => openAdd()} className="text-amber-500 hover:text-amber-600 text-sm font-medium">添加</button>
      </div>

      {/* Type Switch */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4">
        <button
          onClick={() => setViewType('expense')}
          className={`flex-1 py-1.5 text-sm rounded-md font-medium ${viewType === 'expense' ? 'bg-white dark:bg-gray-700 shadow-sm text-red-500' : 'text-gray-500'}`}
        >
          支出分类
        </button>
        <button
          onClick={() => setViewType('income')}
          className={`flex-1 py-1.5 text-sm rounded-md font-medium ${viewType === 'income' ? 'bg-white dark:bg-gray-700 shadow-sm text-green-500' : 'text-gray-500'}`}
        >
          收入分类
        </button>
      </div>

      {/* Category List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
        {topLevel.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-sm">暂无分类</p>
        ) : (
          topLevel.map((c, idx) => {
            const children = childrenOf(c.id!)
            const isExpanded = expandedIds.has(c.id!)
            return (
              <div key={c.id}>
                <div className={`flex items-center px-4 py-3 ${idx > 0 ? 'border-t border-gray-50 dark:border-gray-700' : ''}`}>
                  {children.length > 0 ? (
                    <button onClick={() => toggleExpand(c.id!)} className="text-gray-400 mr-1 w-5 h-5 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  ) : <span className="w-5 mr-1" />}
                  <span className="mr-3 text-gray-600 dark:text-gray-300"><CategoryIcon icon={c.icon} size={22} /></span>
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">{c.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openAdd(c.id!)} className="text-gray-300 hover:text-green-500" title="添加子分类">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button onClick={() => moveUp(c, idx)} className={`text-gray-300 ${idx === 0 ? 'opacity-30' : 'hover:text-gray-600'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button onClick={() => moveDown(c, idx)} className={`text-gray-300 ${idx === topLevel.length - 1 ? 'opacity-30' : 'hover:text-gray-600'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button onClick={() => openEdit(c)} className="text-gray-300 hover:text-amber-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button onClick={() => c.id && deleteCategory(c.id)} className="text-gray-300 hover:text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Children */}
                {isExpanded && children.map((child, cidx) => (
                  <div key={child.id} className="flex items-center px-4 py-2.5 pl-12 bg-gray-50/50 dark:bg-gray-750 border-t border-gray-50 dark:border-gray-700">
                    <span className="mr-3 text-gray-500 dark:text-gray-400"><CategoryIcon icon={child.icon} size={18} /></span>
                    <span className="flex-1 text-sm text-gray-600 dark:text-gray-300">{child.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(child)} className="text-gray-300 hover:text-amber-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button onClick={() => child.id && deleteCategory(child.id)} className="text-gray-300 hover:text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {editingId ? '编辑分类' : form.parent_id ? '添加子分类' : '添加分类'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">图标</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {iconOptions.map(ico => (
                    <button
                      key={ico}
                      onClick={() => setForm({ ...form, icon: ico })}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 ${form.icon === ico ? 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/30' : 'bg-gray-50 dark:bg-gray-700'}`}
                    >
                      <CategoryIcon icon={ico} size={18} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">名称</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如：咖啡" className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400">父分类</label>
                <select
                  value={form.parent_id ?? ''}
                  onChange={e => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600"
                >
                  <option value="">无（顶级分类）</option>
                  {topLevel.filter(c => c.id !== editingId).map(c => (
                    <option key={c.id} value={c.id!}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleSave} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
