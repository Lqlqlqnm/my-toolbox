import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft, Plus, Pencil, Archive, RotateCcw, Trash2 } from 'lucide-react'
import { db, type Book } from '../../lib/db'
import { useModal } from '../../components/Modal'

export default function Books() {
  const [books, setBooks] = useState<Book[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formName, setFormName] = useState('')
  const { showConfirm } = useModal()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const b = await db.books.toArray()
    setBooks(b)
  }

  function openAdd() {
    setFormName('')
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(b: Book) {
    setFormName(b.name)
    setEditingId(b.id!)
    setShowForm(true)
  }

  async function handleSave() {
    if (!formName.trim()) return
    if (editingId) {
      await db.books.update(editingId, { name: formName })
    } else {
      await db.books.add({ name: formName, is_archived: false, created_at: new Date().toISOString() })
    }
    setShowForm(false)
    loadData()
  }

  async function toggleArchive(b: Book) {
    await db.books.update(b.id!, { is_archived: !b.is_archived })
    loadData()
  }

  async function deleteBook(id: number) {
    const txCount = await db.transactions.where('book_id').equals(id).count()
    let msg = '确定删除此账本？'
    if (txCount > 0) {
      msg = `此账本下有 ${txCount} 条记录，删除后记录将归入"默认账本"，确定？`
    }
    const confirmed = await showConfirm('删除账本', msg)
    if (!confirmed) return
    if (txCount > 0) {
      await db.transactions.where('book_id').equals(id).modify({ book_id: null })
    }
    await db.books.delete(id)
    loadData()
  }

  const [txCounts, setTxCounts] = useState<Record<number, number>>({})
  useEffect(() => {
    (async () => {
      const counts: Record<number, number> = {}
      for (const b of books) {
        if (b.id) counts[b.id] = await db.transactions.where('book_id').equals(b.id).count()
      }
      setTxCounts(counts)
    })()
  }, [books])

  const activeBooks = books.filter(b => !b.is_archived)
  const archivedBooks = books.filter(b => b.is_archived)

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/accounting" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">账本管理</h1>
          <button onClick={openAdd} className="text-gray-600 dark:text-gray-300"><Plus size={20} /></button>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <p className="text-xs text-gray-400 mb-4">账本用于分组管理不同场景的记账（如个人、家庭、旅行等）。默认账本包含未指定账本的所有记录。</p>

        {/* Default Book */}
        <div className="bg-white dark:bg-[#141416] rounded-xl p-3.5 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-base">
              📒
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">默认账本</p>
              <p className="text-[11px] text-gray-400">系统内置</p>
            </div>
          </div>
        </div>

        {/* Active Books */}
        <div className="space-y-2">
          {activeBooks.map(b => (
            <div key={b.id} className="bg-white dark:bg-[#141416] rounded-xl p-3.5" onClick={() => openEdit(b)}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-base">
                  📗
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{b.name}</p>
                  <p className="text-[11px] text-gray-400">{txCounts[b.id!] || 0} 条记录</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 dark:border-white/[0.04]" onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleArchive(b)} className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Archive size={12} />
                  归档
                </button>
                <button onClick={() => b.id && deleteBook(b.id)} className="text-[11px] text-gray-400 flex items-center gap-1 ml-auto">
                  <Trash2 size={12} />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Archived */}
        {archivedBooks.length > 0 && (
          <>
            <p className="text-xs text-gray-400 mt-6 mb-2">已归档</p>
            <div className="space-y-2">
              {archivedBooks.map(b => (
                <div key={b.id} className="bg-white dark:bg-[#141416] rounded-xl p-3.5 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-base">
                      📕
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{b.name}</p>
                    </div>
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleArchive(b)} className="text-[11px] text-amber-500 flex items-center gap-1">
                        <RotateCcw size={12} />
                        恢复
                      </button>
                      <button onClick={() => b.id && deleteBook(b.id)} className="text-gray-400">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-lg rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-4">
              {editingId ? '编辑账本' : '新建账本'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">账本名称</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="如：家庭开销" className="w-full mt-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700">
                  取消
                </button>
                <button onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
