import { useState, useEffect } from 'react'
import { db, type TravelTemplate, type TemplateCategory } from '../../lib/db'
import { useModal } from '../../components/Modal'

const ICONS = ['💼', '🏖️', '🏕️', '🎒', '✈️', '🚗', '🏔️', '🎿', '🚢', '👶']

interface Props {
  templateId?: number
  onBack: () => void
}

export default function EditTemplate({ templateId, onBack }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💼')
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [editingCat, setEditingCat] = useState<number | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const { showConfirm, showPrompt } = useModal()

  useEffect(() => {
    if (templateId) loadTemplate()
  }, [templateId])

  async function loadTemplate() {
    const t = await db.travelTemplates.get(templateId!)
    if (t) {
      setName(t.name)
      setIcon(t.icon)
      setCategories(t.categories)
    }
  }

  async function handleSave() {
    if (!name.trim()) return
    const data: Omit<TravelTemplate, 'id'> = {
      name: name.trim(),
      icon,
      categories,
      created_at: new Date().toISOString(),
    }
    if (templateId) {
      await db.travelTemplates.update(templateId, data)
    } else {
      await db.travelTemplates.add(data)
    }
    onBack()
  }

  async function addCategory() {
    const catName = await showPrompt('分类名称', { placeholder: '如：衣物、洗漱、证件' })
    if (!catName) return
    const catIcon = await showPrompt('分类图标', { defaultValue: '📦', placeholder: '一个emoji' }) || '📦'
    setCategories([...categories, { name: catName, icon: catIcon, items: [] }])
  }

  async function removeCategory(index: number) {
    const ok = await showConfirm('删除分类', `确定删除"${categories[index].name}"？`)
    if (!ok) return
    setCategories(categories.filter((_, i) => i !== index))
  }

  function addItem(catIndex: number) {
    if (!newItemText.trim()) return
    const updated = [...categories]
    updated[catIndex].items.push(newItemText.trim())
    setCategories(updated)
    setNewItemText('')
  }

  function removeItem(catIndex: number, itemIndex: number) {
    const updated = [...categories]
    updated[catIndex].items.splice(itemIndex, 1)
    setCategories(updated)
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {templateId ? '编辑模板' : '新建模板'}
          </h1>
        </div>
        <button onClick={handleSave} className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm">保存</button>
      </div>

      {/* 基本信息 */}
      <div className="space-y-3 mb-6">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="模板名称（如：出差3天）"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
        />
        <div>
          <p className="text-xs text-gray-500 mb-1">选择图标</p>
          <div className="flex gap-2 flex-wrap">
            {ICONS.map(i => (
              <button key={i} onClick={() => setIcon(i)}
                className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center ${icon === i ? 'bg-emerald-100 dark:bg-emerald-900 ring-2 ring-emerald-500' : 'bg-gray-100 dark:bg-gray-800'}`}>
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 分类列表 */}
      <div className="space-y-4">
        {categories.map((cat, catIndex) => (
          <div key={catIndex} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{cat.icon} {cat.name}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditingCat(editingCat === catIndex ? null : catIndex)} className="text-xs text-blue-500">
                  {editingCat === catIndex ? '完成' : '编辑'}
                </button>
                <button onClick={() => removeCategory(catIndex)} className="text-xs text-red-400">删除</button>
              </div>
            </div>

            {editingCat === catIndex ? (
              <div className="space-y-1">
                {cat.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex justify-between items-center py-1 px-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                    <span className="text-gray-700 dark:text-gray-300">{item}</span>
                    <button onClick={() => removeItem(catIndex, itemIndex)} className="text-red-400 hover:text-red-500">x</button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input
                    value={newItemText}
                    onChange={e => setNewItemText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem(catIndex)}
                    placeholder="添加物品"
                    className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                  />
                  <button onClick={() => addItem(catIndex)} className="px-2 py-1 text-xs bg-emerald-500 text-white rounded">添加</button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                {cat.items.length > 0 ? cat.items.join(' · ') : '暂无物品'}
              </p>
            )}
          </div>
        ))}

        <button onClick={addCategory}
          className="w-full py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 hover:text-emerald-500">
          + 添加分类
        </button>
      </div>
    </main>
  )
}
