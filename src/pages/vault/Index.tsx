import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type VaultEntry } from '../../lib/db'
import { setupMasterPassword, verifyMasterPassword, encrypt, decrypt, getKeyFromPassword } from '../../lib/vault-crypto'
import { ChevronLeft, Plus, Eye, EyeOff, Copy, Lock, Trash2, Search } from 'lucide-react'

const CATEGORIES = ['全部', '社交', '购物', '工具', '金融', '游戏', '其他']

export default function VaultIndex() {
  const [unlocked, setUnlocked] = useState(false)
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('全部')
  const [showAdd, setShowAdd] = useState(false)
  const [revealedId, setRevealedId] = useState<number | null>(null)
  const [revealedPw, setRevealedPw] = useState('')
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta = useLiveQuery(() => db.vaultMeta.toArray())
  const entries = useLiveQuery(() => db.vaultEntries.toArray())

  const isFirstTime = meta && meta.length === 0

  // Auto-lock after 5 minutes
  const resetAutoLock = () => {
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current)
    autoLockTimer.current = setTimeout(() => {
      setUnlocked(false)
      setCryptoKey(null)
      setRevealedId(null)
      setRevealedPw('')
    }, 5 * 60 * 1000)
  }

  useEffect(() => {
    if (unlocked) resetAutoLock()
    return () => { if (autoLockTimer.current) clearTimeout(autoLockTimer.current) }
  }, [unlocked])

  const handleUnlock = async () => {
    if (!password) return
    setError('')

    if (isFirstTime) {
      // First time: set master password
      const { salt, verify, verifyIv } = await setupMasterPassword(password)
      await db.vaultMeta.bulkPut([
        { key: 'salt', value: salt },
        { key: 'verify', value: verify },
        { key: 'verifyIv', value: verifyIv },
      ])
      const key = await getKeyFromPassword(password, salt)
      setCryptoKey(key)
      setUnlocked(true)
    } else {
      // Verify
      const salt = meta!.find(m => m.key === 'salt')?.value
      const verify = meta!.find(m => m.key === 'verify')?.value
      const verifyIv = meta!.find(m => m.key === 'verifyIv')?.value
      if (!salt || !verify || !verifyIv) { setError('数据损坏'); return }

      const key = await verifyMasterPassword(password, salt, verify, verifyIv)
      if (key) {
        setCryptoKey(key)
        setUnlocked(true)
      } else {
        setError('密码错误')
      }
    }
    setPassword('')
  }

  const handleLock = () => {
    setUnlocked(false)
    setCryptoKey(null)
    setRevealedId(null)
    setRevealedPw('')
  }

  const handleReveal = async (entry: VaultEntry) => {
    if (!cryptoKey) return
    resetAutoLock()
    if (revealedId === entry.id) {
      setRevealedId(null)
      setRevealedPw('')
      return
    }
    try {
      const pw = await decrypt(entry.encrypted_password, entry.iv, cryptoKey)
      setRevealedId(entry.id!)
      setRevealedPw(pw)
    } catch {
      setRevealedPw('解密失败')
    }
  }

  const handleCopy = async (entry: VaultEntry) => {
    if (!cryptoKey) return
    resetAutoLock()
    try {
      const pw = await decrypt(entry.encrypted_password, entry.iv, cryptoKey)
      await navigator.clipboard.writeText(pw)
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除？')) return
    await db.vaultEntries.delete(id)
  }

  // Add form state
  const [addForm, setAddForm] = useState({ name: '', username: '', password: '', url: '', category: '其他', note: '' })

  const handleAdd = async () => {
    if (!addForm.name || !addForm.password || !cryptoKey) return
    resetAutoLock()
    const { ciphertext, iv } = await encrypt(addForm.password, cryptoKey)
    const now = new Date().toISOString()
    await db.vaultEntries.add({
      name: addForm.name.trim(),
      username: addForm.username.trim(),
      encrypted_password: ciphertext,
      iv,
      url: addForm.url.trim(),
      category: addForm.category,
      note: addForm.note.trim(),
      created_at: now,
      updated_at: now,
    } as VaultEntry)
    setAddForm({ name: '', username: '', password: '', url: '', category: '其他', note: '' })
    setShowAdd(false)
  }

  // Filter
  const filtered = (entries || [])
    .filter(e => catFilter === '全部' || e.category === catFilter)
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.username.toLowerCase().includes(search.toLowerCase()))

  // Lock screen
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
        <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/" className="text-gray-400"><ChevronLeft size={20} /></Link>
            <h1 className="text-base font-semibold text-gray-800 dark:text-white">密码本</h1>
            <div className="w-5" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center px-6 pt-20">
          <div className="text-5xl mb-4">🔐</div>
          <p className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            {isFirstTime ? '设置主密码' : '输入主密码'}
          </p>
          <p className="text-xs text-gray-400 text-center mb-6">
            {isFirstTime ? '首次使用，请设置一个主密码来保护你的数据' : '主密码仅存于你的记忆中，忘记将无法恢复'}
          </p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="••••••••"
            className="w-full max-w-[260px] px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#141416] text-center text-base tracking-widest outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
            autoFocus
          />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <button onClick={handleUnlock} className="w-full max-w-[260px] mt-3 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold">
            {isFirstTime ? '设置密码' : '解锁'}
          </button>
        </div>
      </div>
    )
  }

  // Unlocked view
  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#0c0c0d]">
      <div className="bg-white dark:bg-[#141416] border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="text-gray-400"><ChevronLeft size={20} /></Link>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">密码本</h1>
          <button onClick={handleLock} className="text-gray-400"><Lock size={18} /></button>
        </div>
      </div>

      <div className="p-4" onClick={resetAutoLock}>
        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索平台名称或用户名..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#141416] text-sm outline-none focus:border-indigo-400 text-gray-700 dark:text-gray-200"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${catFilter === c ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-[#141416] text-gray-500 border border-gray-200 dark:border-white/[0.06]'}`}>
              {c}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.map(entry => (
            <div key={entry.id} className="bg-white dark:bg-[#141416] rounded-xl p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-500">
                  {entry.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{entry.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{entry.username}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleReveal(entry)} className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-indigo-500">
                    {revealedId === entry.id ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button onClick={() => handleCopy(entry)} className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-indigo-500">
                    <Copy size={13} />
                  </button>
                  <button onClick={() => handleDelete(entry.id!)} className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {revealedId === entry.id && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-mono bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200">{revealedPw}</p>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">暂无账号</p>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-300 dark:text-gray-600 mt-6">5 分钟无操作自动锁定</p>
        <div style={{ height: 80 }} />
      </div>

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} className="fixed bottom-7 right-[calc(50%-175px)] w-12 h-12 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center shadow-lg z-10">
        <Plus size={20} />
      </button>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-[390px] rounded-t-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">添加账号</p>
            <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="平台名称" autoFocus className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
            <input value={addForm.username} onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} placeholder="用户名/邮箱/手机号" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
            <input type="password" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} placeholder="密码" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
            <input value={addForm.url} onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))} placeholder="网址（可选）" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200" />
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter(c => c !== '全部').map(c => (
                <button key={c} onClick={() => setAddForm(f => ({ ...f, category: c }))} className={`px-3 py-1.5 rounded-full text-xs ${addForm.category === c ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{c}</button>
              ))}
            </div>
            <textarea value={addForm.note} onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))} placeholder="备注（可选）" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-transparent text-sm outline-none resize-none h-12 text-gray-700 dark:text-gray-200" />
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">取消</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">加密保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
