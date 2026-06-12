import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAIConfig, saveAIConfig } from '../lib/ai'
import { shareBackup, importBackup, type BackupData } from '../lib/backup'
import { getThemeMode, setThemeMode, type ThemeMode } from '../lib/theme'
import { registerPush, unregisterPush, getPushStatus } from '../lib/notify'

export default function Settings() {
  const [aiConfig, setAiConfig] = useState(() => getAIConfig() || { apiKey: '', baseUrl: 'https://bmc-llm-relay.bluemediagroup.cn/v1', model: 'gpt-4o-mini' })
  const [message, setMessage] = useState('')
  const [backupInterval, setBackupInterval] = useState(() => localStorage.getItem('backup_interval_days') || '7')
  const [theme, setTheme] = useState<ThemeMode>(() => getThemeMode())
  const [pushStatus, setPushStatus] = useState<'active' | 'inactive' | 'unsupported' | 'loading'>('loading')

  useEffect(() => {
    getPushStatus().then(setPushStatus)
  }, [])

  const handleTogglePush = async () => {
    if (pushStatus === 'active') {
      await unregisterPush()
      setPushStatus('inactive')
      setMessage('已关闭推送通知')
    } else {
      const result = await registerPush()
      if (result === 'granted') {
        setPushStatus('active')
        setMessage('推送通知已开启')
      } else if (result === 'denied') {
        setMessage('通知权限被拒绝，请在系统设置中允许')
      } else {
        setMessage('当前浏览器不支持推送通知')
      }
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const handleSaveAI = () => {
    saveAIConfig(aiConfig)
    setMessage('AI 配置已保存')
    setTimeout(() => setMessage(''), 2000)
  }

  const handleBackup = async () => {
    const result = await shareBackup()
    setMessage(result === 'shared' ? '已分享备份文件' : '已下载备份文件')
    setTimeout(() => setMessage(''), 2000)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text) as BackupData
      if (!data.version || !data.app) { setMessage('无效的备份文件'); return }
      const { imported } = await importBackup(data)
      setMessage(`恢复成功! 导入 ${imported} 条数据`)
    } catch { setMessage('导入失败: 文件格式错误') }
    e.target.value = ''
    setTimeout(() => setMessage(''), 3000)
  }

  const handleSaveInterval = () => {
    localStorage.setItem('backup_interval_days', backupInterval)
    setMessage('备份提醒间隔已保存')
    setTimeout(() => setMessage(''), 2000)
  }

  const handleClearCloudImages = async () => {
    if (!confirm('确定清空所有云端图片？')) return
    try {
      const resp = await fetch('/api/images/all', { method: 'DELETE' })
      const data = await resp.json() as any
      setMessage(`已清空 ${data.deleted} 张云端图片`)
    } catch {
      setMessage('清空失败')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-4 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">设置</h1>
      </div>

      {/* Theme */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">外观</h2>
        <div className="flex gap-2">
          {([['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => { setTheme(value); setThemeMode(value) }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === value
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-[#141416] text-gray-600 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Push Notifications */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">推送通知</h2>
        {pushStatus === 'unsupported' ? (
          <p className="text-xs text-gray-400">当前浏览器不支持推送通知。iOS 需添加到主屏幕后才能使用。</p>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-200">
                {pushStatus === 'active' ? '已开启' : '未开启'}
              </p>
              <p className="text-xs text-gray-400">条件单成交、止损止盈等事件将推送到手机</p>
            </div>
            <button
              onClick={handleTogglePush}
              disabled={pushStatus === 'loading'}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                pushStatus === 'active' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                pushStatus === 'active' ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        )}
      </section>

      {/* AI Config */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">AI 配置</h2>
        <div className="space-y-2">
          <input
            type="password"
            value={aiConfig.apiKey}
            onChange={e => setAiConfig(c => ({ ...c, apiKey: e.target.value }))}
            placeholder="API Key"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#141416] text-sm"
          />
          <input
            type="url"
            value={aiConfig.baseUrl}
            onChange={e => setAiConfig(c => ({ ...c, baseUrl: e.target.value }))}
            placeholder="Base URL"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#141416] text-sm"
          />
          <input
            type="text"
            value={aiConfig.model}
            onChange={e => setAiConfig(c => ({ ...c, model: e.target.value }))}
            placeholder="模型名称 (如 gpt-4o-mini)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#141416] text-sm"
          />
          <button onClick={handleSaveAI} className="w-full py-2 bg-amber-500 text-white rounded-lg text-sm">保存 AI 配置</button>
        </div>
      </section>

      {/* Backup */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">数据管理</h2>
        <div className="space-y-2">
          <button onClick={handleBackup} className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm">一键备份 (分享/下载 JSON)</button>
          <label className="block w-full py-2.5 bg-gray-100 dark:bg-[#141416] text-gray-600 dark:text-gray-300 rounded-lg text-sm text-center cursor-pointer">
            导入恢复
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleClearCloudImages} className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg text-sm border border-red-200 dark:border-red-800">清空云端图片</button>
        </div>
      </section>

      {/* Backup Reminder */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">备份提醒</h2>
        <div className="flex gap-2">
          <select
            value={backupInterval}
            onChange={e => setBackupInterval(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#141416] text-sm"
          >
            <option value="7">每 7 天提醒</option>
            <option value="14">每 14 天提醒</option>
            <option value="30">每 30 天提醒</option>
            <option value="0">关闭提醒</option>
          </select>
          <button onClick={handleSaveInterval} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">保存</button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          上次备份: {localStorage.getItem('last_backup_time')?.split('T')[0] || '从未备份'}
        </p>
      </section>

      {message && (
        <p className={`text-center text-sm ${message.includes('成功') || message.includes('保存') || message.includes('分享') || message.includes('下载') ? 'text-green-500' : 'text-red-500'}`}>
          {message}
        </p>
      )}
    </main>
  )
}
