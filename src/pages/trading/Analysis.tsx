import { useState, useEffect, useRef } from 'react'
import { analyzeArticles, type AnalysisResult, type ImageInput } from '../../lib/ai'
import { getAnalyses, submitAnalysis, uploadImage, fetchArticleUrl } from '../../lib/api'

interface ServerOrder {
  code: string
  name: string
  trigger_price: number
  trigger_reason: string
  signals: Array<{ name: string; strength: string; description: string }>
  levels: { currentPrice: number; ma5: number; recentHigh: number; recentLow: number }
  position_pct: number
  stop_loss_pct: number
  trailing_pct: number
  activation_pct: number
  max_hold_days: number
  reason: string
}

interface InputItem {
  type: 'text' | 'image' | 'url'
  content: string // text content, base64, or url
  mime_type?: string
  preview?: string // thumbnail or extracted text preview
  imageId?: number // server-side image id
  loading?: boolean
}

export default function Analysis() {
  const [inputs, setInputs] = useState<InputItem[]>([{ type: 'text', content: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [serverOrders, setServerOrders] = useState<ServerOrder[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    try {
      const records = await getAnalyses()
      setHistory(records || [])
    } catch {}
  }

  function addTextInput() {
    setInputs([...inputs, { type: 'text', content: '' }])
  }

  function addUrlInput() {
    setInputs([...inputs, { type: 'url', content: '', preview: '' }])
  }

  function removeInput(index: number) {
    if (inputs.length <= 1) return
    setInputs(inputs.filter((_, i) => i !== index))
  }

  function updateInput(index: number, content: string) {
    const updated = [...inputs]
    updated[index] = { ...updated[index], content }
    setInputs(updated)
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > 5 * 1024 * 1024) {
        setError('图片不能超过 5MB')
        continue
      }

      // Read as base64
      const base64 = await fileToBase64(file)
      const preview = URL.createObjectURL(file)

      // Upload to server for storage
      const newItem: InputItem = {
        type: 'image',
        content: base64,
        mime_type: file.type,
        preview,
        loading: true,
      }
      setInputs(prev => [...prev, newItem])

      try {
        const { id } = await uploadImage(file)
        setInputs(prev => prev.map(item =>
          item === newItem ? { ...item, imageId: id, loading: false } : item
        ))
      } catch {
        setInputs(prev => prev.map(item =>
          item === newItem ? { ...item, loading: false } : item
        ))
      }
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUrlFetch(index: number) {
    const url = inputs[index].content.trim()
    if (!url) return

    const updated = [...inputs]
    updated[index] = { ...updated[index], loading: true, preview: '' }
    setInputs(updated)

    try {
      const { text } = await fetchArticleUrl(url)
      setInputs(prev => {
        const u = [...prev]
        u[index] = { ...u[index], preview: text, loading: false }
        return u
      })
    } catch (e) {
      setInputs(prev => {
        const u = [...prev]
        u[index] = { ...u[index], preview: '', loading: false }
        return u
      })
      setError(e instanceof Error ? e.message : '抓取失败')
    }
  }

  async function handleAnalyze() {
    const articles: string[] = []
    const images: ImageInput[] = []

    for (const item of inputs) {
      if (item.type === 'text' && item.content.trim()) {
        articles.push(item.content)
      } else if (item.type === 'url' && item.preview) {
        articles.push(item.preview)
      } else if (item.type === 'image' && item.content) {
        images.push({ base64: item.content, mime_type: item.mime_type || 'image/jpeg' })
      }
    }

    if (articles.length === 0 && images.length === 0) {
      setError('请至少提供一篇文章内容或一张图片')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const analysisResult = await analyzeArticles(articles, images)
      setResult(analysisResult)

      const { createdCount, orders: genOrders } = await submitAnalysis({
        articles,
        market_view: analysisResult.market_view,
        main_sectors: analysisResult.main_sectors,
        core_logic: analysisResult.core_logic,
        etf_recommendations: analysisResult.etf_recommendations,
      })

      setServerOrders(genOrders || [])
      await loadHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Input List */}
      <div className="space-y-3">
        {inputs.map((item, i) => (
          <div key={i}>
            {item.type === 'text' && (
              <div className="relative">
                <textarea
                  value={item.content}
                  onChange={e => updateInput(i, e.target.value)}
                  placeholder={`粘贴文章${i + 1}正文（支持 HTML，自动清洗）`}
                  className="w-full h-32 px-3 py-2 text-sm border border-gray-200 dark:border-white/[0.06] rounded-xl bg-white dark:bg-[#141416] resize-none shadow-sm"
                />
                {inputs.length > 1 && (
                  <button onClick={() => removeInput(i)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-xs">删除</button>
                )}
              </div>
            )}
            {item.type === 'url' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={item.content}
                    onChange={e => updateInput(i, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUrlFetch(i)}
                    placeholder="粘贴文章链接"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/[0.06] rounded-xl bg-white dark:bg-[#141416] shadow-sm"
                  />
                  <button
                    onClick={() => handleUrlFetch(i)}
                    disabled={item.loading || !item.content.trim()}
                    className="px-3 py-2 text-xs bg-blue-500 text-white rounded-xl disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {item.loading ? '...' : '提取'}
                  </button>
                  {inputs.length > 1 && (
                    <button onClick={() => removeInput(i)} className="text-gray-400 hover:text-red-500 shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
                {item.preview && (
                  <div className="px-3 py-2 bg-gray-50 dark:bg-[#0c0c0d] rounded-lg text-xs text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">
                    {item.preview.substring(0, 300)}...
                  </div>
                )}
              </div>
            )}
            {item.type === 'image' && (
              <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-white/[0.06] rounded-xl bg-white dark:bg-[#141416] shadow-sm">
                {item.preview && (
                  <img src={item.preview} alt="预览" className="w-16 h-16 object-cover rounded-lg" />
                )}
                <div className="flex-1 text-xs text-gray-500">
                  {item.loading ? '上传中...' : item.imageId ? `已上传 (ID: ${item.imageId})` : '图片就绪'}
                </div>
                {inputs.length > 1 && (
                  <button onClick={() => removeInput(i)} className="text-gray-400 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={addTextInput} className="text-xs text-blue-500 dark:text-blue-400">+ 文章</button>
        <button onClick={addUrlInput} className="text-xs text-green-500 dark:text-green-400">+ 链接</button>
        <button onClick={() => fileInputRef.current?.click()} className="text-xs text-purple-500 dark:text-purple-400">+ 图片</button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
      </div>

      {/* Analyze button */}
      <button onClick={handleAnalyze} disabled={loading} className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
        {loading ? 'AI 分析中...' : 'AI 分析'}
      </button>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Result display */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400 dark:hidden" />
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-1">大盘观点</p>
            <p className="text-sm text-gray-900 dark:text-white">{result.market_view}</p>
          </div>
          <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-400 dark:hidden" />
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-2">主线方向</p>
            <div className="flex flex-wrap gap-1.5">
              {result.main_sectors.map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs rounded-full">{s}</span>
              ))}
            </div>
          </div>
          <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 dark:hidden" />
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-1">核心逻辑</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{result.core_logic}</p>
          </div>
          {result.risk_level && (
            <div className={`rounded-xl p-4 bg-white dark:bg-[#141416] border shadow-sm relative overflow-hidden ${
              result.risk_level === 'high' ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-white/[0.06]'
            }`}>
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${result.risk_level === 'high' ? 'bg-red-400' : result.risk_level === 'medium' ? 'bg-amber-400' : 'bg-green-400'} dark:hidden`} />
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-1">风险评级</p>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  result.risk_level === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  result.risk_level === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                }`}>{result.risk_level === 'high' ? '高风险' : result.risk_level === 'medium' ? '中等' : '低风险'}</span>
                <span className="text-xs text-gray-500">{result.risk_reason}</span>
              </div>
            </div>
          )}
          {serverOrders.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2">条件单（技术面定价）</p>
              <div className="space-y-2">
                {serverOrders.map((order, i) => (
                  <div key={i} className="rounded-xl p-3 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-green-400 dark:hidden" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{order.name}({order.code})</span>
                      <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                        买入 @¥{order.trigger_price.toFixed(3)}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
                      现价 ¥{order.levels?.currentPrice?.toFixed(3)} | 仓位{order.position_pct}% | 止损{order.stop_loss_pct}% | 止盈回撤{order.trailing_pct}% | 最长{order.max_hold_days}天
                    </div>
                    <div className="text-[10px] text-blue-500 mt-0.5">{order.trigger_reason}</div>
                    {order.signals && order.signals.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {order.signals.map((sig, j) => (
                          <span key={j} className={`px-1.5 py-0.5 rounded text-[9px] ${
                            sig.strength === 'strong' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>{sig.name}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">{order.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div>
        <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600">
          {showHistory ? '收起历史' : `历史分析 (${history.length})`}
        </button>
        {showHistory && history.length > 0 && (
          <div className="mt-2 space-y-2">
            {history.map((record: any) => {
              const isExpanded = expandedHistoryId === record.id
              let orders: any[] = []
              let sectors: string[] = []
              let etfMapping: Record<string, any> = {}
              try { orders = JSON.parse(record.orders || '[]') } catch {}
              try { sectors = JSON.parse(record.main_sectors || '[]') } catch {}
              try {
                const parsed = JSON.parse(record.etf_mapping || '{}')
                etfMapping = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {}
              } catch {}
              return (
              <div key={record.id} className="rounded-xl bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden text-xs">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:hidden" />
                {/* Header - clickable */}
                <div className="p-3 cursor-pointer" onClick={() => setExpandedHistoryId(isExpanded ? null : record.id)}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 dark:text-gray-600">{record.created_at?.split('T')[0]}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{orders.length} 个条件单</span>
                      <svg className={`w-3 h-3 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-900 dark:text-white mt-1">{record.market_view}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sectors.map((s: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-gray-500/10 text-gray-600 dark:text-gray-400 rounded-full text-[10px]">{s}</span>
                    ))}
                  </div>
                </div>
                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-50 dark:border-white/[0.04] pt-2 space-y-2">
                    {record.core_logic && (
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">核心逻辑</p>
                        <p className="text-gray-700 dark:text-gray-300">{record.core_logic}</p>
                      </div>
                    )}
                    {Object.keys(etfMapping).length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">ETF 映射</p>
                        {Object.entries(etfMapping).map(([sector, codes]) => (
                          <div key={sector} className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="text-gray-600 dark:text-gray-400">{sector}:</span>
                            {(Array.isArray(codes) ? codes : [String(codes)]).map((c: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[10px]">{c}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {orders.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">条件单</p>
                        {orders.map((o: any, i: number) => (
                          <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-white/[0.03] last:border-0">
                            <span className="text-gray-700 dark:text-gray-300">{o.name}({o.code})</span>
                            <span className="text-green-600 dark:text-green-400">@¥{o.trigger_price?.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm('删除此分析记录？')) return
                        await fetch(`/api/analyses/${record.id}`, { method: 'DELETE' })
                        await loadHistory()
                        setExpandedHistoryId(null)
                      }}
                      className="text-[10px] text-red-400 hover:text-red-500 mt-1"
                    >
                      删除此记录
                    </button>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper: File to base64 (without data: prefix)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove "data:image/xxx;base64," prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
