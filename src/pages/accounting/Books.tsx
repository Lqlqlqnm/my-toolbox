import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db, type Book } from '../../lib/db'

export default function Books() {
  const [books, setBooks] = useState<Book[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formName, setFormName] = useState('')

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
    if (txCount > 0) {
      if (!confirm(`此账本下有 ${txCount} 条记录，删除账本后记录将变为"默认账本"，确定？`)) return
      await db.transactions.where('book_id').equals(id).modify({ book_id: null })
    }
    await db.books.delete(id)
    loadData()
  }

  async function getBookTxCount(bookId: number) {
    return db.transactions.where('book_id').equals(bookId).count()
  }

  const [txCounts, setTxCounts] = useState<Record<number, number>>({})
  useEffect(() => {
    (async () => {
      const counts: Record<number, number> = {}
      for (const b of books) {
        if (b.id) counts[b.id] = await getBookTxCount(b.id)
      }
      setTxCounts(counts)
    })()
  }, [books])

  const activeBooks = books.filter(b => !b.is_archived)
  const archivedBooks = books.filter(b => b.is_archived)

  return (
    <main className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/accounting" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">账本管理</h1>
        <button onClick={openAdd} className="text-amber-500 hover:text-amber-600 text-sm font-medium">新建</button>
      </div>

      <p className="text-xs text-gray-400 mb-4">账本用于分组管理不同场景的记账（如个人、家庭、旅行等）。默认账本包含未指定账本的所有记录。</p>

      {/* Default Book */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 shadow-sm border border-amber-200 dark:border-amber-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📒</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">默认账本</span>
          </div>
          <span className="text-xs text-gray-400">系统内置</span>
        </div>
      </div>

      {/* Active Books */}
      {activeBooks.length > 0 && (
        <div className="space-y-3 mb-4">
          {activeBooks.map(b => (
            <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📗</span>
                  <div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{b.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{txCounts[b.id!] || 0} 条</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(b)} className="text-gray-300 hover:text-amber-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button onClick={() => toggleArchive(b)} className="text-xs text-gray-400 hover:text-gray-600">归档</button>
                  <button onClick={() => b.id && deleteBook(b.id)} className="text-gray-300 hover:text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived */}
      {archivedBooks.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-2">已归档</p>
          <div className="space-y-2">
            {archivedBooks.map(b => (
              <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>📕</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{b.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleArchive(b)} className="text-xs text-amber-500">恢复</button>
                    <button onClick={() => b.id && deleteBook(b.id)} className="text-gray-300 hover:text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {editingId ? '编辑账本' : '新建账本'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">账本名称</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="如：家庭开销" className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600" />
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
