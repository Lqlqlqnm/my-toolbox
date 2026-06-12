import { useState } from 'react'
import { db, type CorrelationVariable, type VariableType } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, GripVertical, Trash2, Eye, EyeOff } from 'lucide-react'

export default function Variables() {
  const variables = useLiveQuery(() => db.correlationVariables.orderBy('sort_order').toArray())
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<VariableType>('rating')
  const [newUnit, setNewUnit] = useState('')
  const [newOptions, setNewOptions] = useState('')

  if (!variables) return null

  const handleAdd = async () => {
    if (!newName.trim()) return
    const maxOrder = variables.length > 0 ? Math.max(...variables.map(v => v.sort_order)) : 0
    const v: Omit<CorrelationVariable, 'id'> = {
      name: newName.trim(),
      type: newType,
      icon: 'circle',
      sort_order: maxOrder + 1,
      is_active: true,
    }
    if (newType === 'number' && newUnit) v.unit = newUnit
    if (newType === 'number') { v.min = 0; v.max = 99; v.step = 1 }
    if (newType === 'category' && newOptions) {
      v.options = newOptions.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
    }
    await db.correlationVariables.add(v as CorrelationVariable)
    setNewName('')
    setNewUnit('')
    setNewOptions('')
    setAdding(false)
  }

  const toggleActive = async (v: CorrelationVariable) => {
    await db.correlationVariables.update(v.id!, { is_active: !v.is_active })
  }

  const handleDelete = async (v: CorrelationVariable) => {
    if (!confirm(`确定删除变量「${v.name}」？相关记录也会丢失。`)) return
    await db.correlationRecords.where('variable_id').equals(v.id!).delete()
    await db.correlationVariables.delete(v.id!)
  }

  const moveUp = async (v: CorrelationVariable, idx: number) => {
    if (idx === 0) return
    const prev = variables[idx - 1]
    await db.correlationVariables.update(v.id!, { sort_order: prev.sort_order })
    await db.correlationVariables.update(prev.id!, { sort_order: v.sort_order })
  }

  const moveDown = async (v: CorrelationVariable, idx: number) => {
    if (idx === variables.length - 1) return
    const next = variables[idx + 1]
    await db.correlationVariables.update(v.id!, { sort_order: next.sort_order })
    await db.correlationVariables.update(next.id!, { sort_order: v.sort_order })
  }

  const typeLabel: Record<VariableType, string> = { rating: '评分', number: '数值', boolean: '是/否', category: '分类' }
  const typeColor: Record<VariableType, string> = { rating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', number: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', boolean: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', category: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' }

  return (
    <div className="p-4 pb-20">
      {/* Stats */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-gray-800 dark:text-white">{variables.filter(v => v.is_active).length}</p>
          <p className="text-[10px] text-gray-400">活跃变量</p>
        </div>
        <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-gray-800 dark:text-white">{variables.length}</p>
          <p className="text-[10px] text-gray-400">总变量</p>
        </div>
      </div>

      {/* Variable list */}
      <div className="bg-white dark:bg-[#141416] rounded-xl divide-y divide-gray-50 dark:divide-white/[0.04]">
        {variables.map((v, idx) => (
          <div key={v.id} className={`flex items-center gap-3 px-4 py-3 ${!v.is_active ? 'opacity-40' : ''}`}>
            <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{v.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeColor[v.type]}`}>{typeLabel[v.type]}</span>
              </div>
              {v.unit && <p className="text-[10px] text-gray-400">单位: {v.unit}</p>}
              {v.options && <p className="text-[10px] text-gray-400">选项: {v.options.join(' / ')}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => moveUp(v, idx)} className="p-1 text-gray-300 hover:text-gray-500" disabled={idx === 0}>↑</button>
              <button onClick={() => moveDown(v, idx)} className="p-1 text-gray-300 hover:text-gray-500" disabled={idx === variables.length - 1}>↓</button>
              <button onClick={() => toggleActive(v)} className="p-1 text-gray-300 hover:text-gray-500">
                {v.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button onClick={() => handleDelete(v)} className="p-1 text-gray-300 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding ? (
        <div className="mt-4 bg-white dark:bg-[#141416] rounded-xl p-4 space-y-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="变量名称"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
            autoFocus
          />
          <div className="flex gap-2">
            {(['rating', 'number', 'boolean', 'category'] as VariableType[]).map(t => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  newType === t ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}
              >
                {typeLabel[t]}
              </button>
            ))}
          </div>
          {newType === 'number' && (
            <input
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              placeholder="单位（如 h、杯、步）"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
            />
          )}
          {newType === 'category' && (
            <input
              value={newOptions}
              onChange={e => setNewOptions(e.target.value)}
              placeholder="选项，用逗号分隔（如 晴,阴,雨）"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
            />
          )}
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-lg text-sm text-gray-500 bg-gray-100 dark:bg-gray-800">取消</button>
            <button onClick={handleAdd} className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900">添加</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 flex items-center justify-center gap-2"
        >
          <Plus size={16} /> 添加变量
        </button>
      )}
    </div>
  )
}
