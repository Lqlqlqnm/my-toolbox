import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type StorageLocation, type StorageItem } from '../../lib/db'
import { ChevronLeft, ChevronRight, Plus, Search, Package, MapPin, Trash2, Edit2, ArrowRightLeft } from 'lucide-react'

export default function StorageIndex() {
  const locations = useLiveQuery(() => db.storageLocations.orderBy('sort_order').toArray())
  const items = useLiveQuery(() => db.storageItems.toArray())
  const [search, setSearch] = useState('')
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set())
  const [showAdd, setShowAdd] = useState<'location' | 'item' | null>(null)
  const [selectedParent, setSelectedParent] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📦')
  // Item form
  const [itemName, setItemName] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemLocation, setItemLocation] = useState<number | null>(null)
  const [itemTags, setItemTags] = useState('')
  // Multi-select for batch move
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [moveTarget, setMoveTarget] = useState<number | null>(null)

  if (!locations || !items) return null

  // Build tree
  const rooms = locations.filter(l => l.parent_id === null)
  const getChildren = (parentId: number) => locations.filter(l => l.parent_id === parentId)
  const getItems = (locationId: number) => items.filter(i => i.location_id === locationId)

  // Search
  const searchResults = search.trim()
    ? items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      )
    : null

  const getLocationPath = (locationId: number): string => {
    const loc = locations.find(l => l.id === locationId)
    if (!loc) return ''
    if (loc.parent_id === null) return loc.name
    const parent = locations.find(l => l.id === loc.parent_id)
    return parent ? `${parent.name} › ${loc.name}` : loc.name
  }

  const toggleRoom = (id: number) => {
    const next = new Set(expandedRooms)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedRooms(next)
  }

  const handleAddLocation = async () => {
    if (!newName.trim()) return
    const maxOrder = locations.length > 0 ? Math.max(...locations.map(l => l.sort_order)) : 0
    await db.storageLocations.add({
      name: newName.trim(),
      parent_id: selectedParent,
      icon: newIcon,
      sort_order: maxOrder + 1,
    } as StorageLocation)
    setNewName('')
    setShowAdd(null)
  }

  const handleAddItem = async () => {
    if (!itemName.trim() || !itemLocation) return
    const now = new Date().toISOString()
    await db.storageItems.add({
      name: itemName.trim(),
      location_id: itemLocation,
      quantity: Number(itemQty) || 1,
      tags: itemTags.split(/[,，、]/).map(s => s.trim()).filter(Boolean),
      note: '',
      created_at: now,
      updated_at: now,
    } as StorageItem)
    setItemName('')
    setItemQty('1')
    setItemTags('')
    setShowAdd(null)
  }

  const handleDeleteItem = async (id: number) => {
    await db.storageItems.delete(id)
  }

  const handleDeleteLocation = async (id: number) => {
    const childItems = items.filter(i => i.location_id === id)
    const childLocs = locations.filter(l => l.parent_id === id)
    if (childItems.length > 0 || childLocs.length > 0) {
      alert('请先移走或删除此位置下的物品和子位置')
      return
    }
    await db.storageLocations.delete(id)
  }

  const handleBatchMove = async () => {
    if (!moveTarget || selected.size === 0) return
    const now = new Date().toISOString()
    for (const itemId of selected) {
      await db.storageItems.update(itemId, { location_id: moveTarget, updated_at: now })
    }
    setSelected(new Set())
    setSelecting(false)
    setMoveTarget(null)
  }

  // All locations for item placement (including rooms)
  const allPlaceableLocations = locations

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">储物定位</h1>
          <button onClick={() => setSelecting(!selecting)} className={`text-xs px-2 py-1 rounded ${selecting ? 'bg-indigo-500 text-white' : 'text-gray-400'}`}>
            {selecting ? '取消' : '多选'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索物品名称或标签..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#141416] text-sm outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
          />
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-2.5 text-center">
            <p className="text-base font-bold text-gray-800 dark:text-white">{rooms.length}</p>
            <p className="text-[10px] text-gray-400">房间</p>
          </div>
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-2.5 text-center">
            <p className="text-base font-bold text-gray-800 dark:text-white">{locations.filter(l => l.parent_id !== null).length}</p>
            <p className="text-[10px] text-gray-400">储物位置</p>
          </div>
          <div className="flex-1 bg-white dark:bg-[#141416] rounded-xl p-2.5 text-center">
            <p className="text-base font-bold text-gray-800 dark:text-white">{items.length}</p>
            <p className="text-[10px] text-gray-400">物品</p>
          </div>
        </div>

        {/* Search results */}
        {searchResults && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-gray-400">搜索结果 ({searchResults.length})</p>
            {searchResults.map(item => (
              <div key={item.id} className="bg-white dark:bg-[#141416] rounded-xl p-3">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{getLocationPath(item.location_id)} · 数量: {item.quantity}</p>
              </div>
            ))}
            {searchResults.length === 0 && <p className="text-center text-sm text-gray-400 py-4">未找到</p>}
          </div>
        )}

        {/* Location tree */}
        {!searchResults && (
          <div className="space-y-2">
            {rooms.map(room => {
              const children = getChildren(room.id!)
              const roomItemCount = children.reduce((sum, c) => sum + getItems(c.id!).length, 0) + getItems(room.id!).length
              const isOpen = expandedRooms.has(room.id!)

              return (
                <div key={room.id} className="bg-white dark:bg-[#141416] rounded-xl overflow-hidden">
                  <div className="flex items-center">
                    <button onClick={() => toggleRoom(room.id!)} className="flex-1 flex items-center gap-3 px-4 py-3">
                      <span className="text-lg">{room.icon}</span>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{room.name}</p>
                        <p className="text-[10px] text-gray-400">{children.length}个位置 · {roomItemCount}件物品</p>
                      </div>
                      <ChevronRight size={14} className={`text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isOpen && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteLocation(room.id!) }} className="pr-4 text-gray-300 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-3 space-y-2">
                      {children.map(child => {
                        const childItems = getItems(child.id!)
                        return (
                          <div key={child.id} className="pl-2 border-l-2 border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{child.icon} {child.name}</p>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded">{childItems.length}件</span>
                                <button onClick={() => handleDeleteLocation(child.id!)} className="text-gray-300 hover:text-red-400 p-0.5"><Trash2 size={10} /></button>
                              </div>
                            </div>
                            {childItems.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {childItems.map(item => (
                                  <span
                                    key={item.id}
                                    onClick={() => {
                                      if (selecting) {
                                        const next = new Set(selected)
                                        next.has(item.id!) ? next.delete(item.id!) : next.add(item.id!)
                                        setSelected(next)
                                      }
                                    }}
                                    className={`text-[11px] px-2 py-0.5 rounded-lg cursor-default ${
                                      selecting && selected.has(item.id!)
                                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-400'
                                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {/* Add sub-location button */}
                      <button
                        onClick={() => { setSelectedParent(room.id!); setShowAdd('location') }}
                        className="text-[11px] text-gray-400 pl-2"
                      >
                        + 添加位置
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Batch move bar */}
        {selecting && selected.size > 0 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[360px] bg-white dark:bg-[#1a1a1a] rounded-xl shadow-lg p-3 flex items-center gap-2 border border-gray-200 dark:border-gray-700 z-20">
            <span className="text-xs text-gray-500">已选 {selected.size} 件</span>
            <select
              value={moveTarget ?? ''}
              onChange={e => setMoveTarget(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-700 dark:text-gray-200"
            >
              <option value="">移动到...</option>
              {allPlaceableLocations.map(l => (
                <option key={l.id} value={l.id}>{getLocationPath(l.id!)} </option>
              ))}
            </select>
            <button onClick={handleBatchMove} disabled={!moveTarget} className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded-lg disabled:opacity-40">
              移动
            </button>
          </div>
        )}

        {/* Add forms */}
        {showAdd === 'location' && (
          <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" onClick={() => setShowAdd(null)}>
            <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-[390px] rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">
                {selectedParent ? `在「${locations.find(l => l.id === selectedParent)?.name}」下添加` : '添加房间'}
              </p>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="名称" autoFocus className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(null)} className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">取消</button>
                <button onClick={handleAddLocation} className="flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">添加</button>
              </div>
            </div>
          </div>
        )}

        {showAdd === 'item' && (
          <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" onClick={() => setShowAdd(null)}>
            <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-[390px] rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">添加物品</p>
              <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="物品名称" autoFocus className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
              <div className="flex gap-2">
                <input type="number" value={itemQty} onChange={e => setItemQty(e.target.value)} placeholder="数量" min="1" className="w-20 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
                <select value={itemLocation ?? ''} onChange={e => setItemLocation(Number(e.target.value) || null)} className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm text-gray-700 dark:text-gray-200">
                  <option value="">选择位置</option>
                  {allPlaceableLocations.map(l => <option key={l.id} value={l.id}>{getLocationPath(l.id!)}</option>)}
                </select>
              </div>
              <input value={itemTags} onChange={e => setItemTags(e.target.value)} placeholder="标签(逗号分隔)" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(null)} className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">取消</button>
                <button onClick={handleAddItem} className="flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">添加</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-7 right-[calc(50%-175px)] flex gap-2 z-10">
        <button onClick={() => { setSelectedParent(null); setShowAdd('location') }} className="w-11 h-11 rounded-full bg-gray-700 text-white flex items-center justify-center shadow-lg text-xs">
          <MapPin size={16} />
        </button>
        <button onClick={() => setShowAdd('item')} className="w-11 h-11 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-lg">
          <Plus size={20} />
        </button>
      </div>
    </div>
  )
}
