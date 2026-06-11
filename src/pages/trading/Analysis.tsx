import { useState, useEffect } from 'react'
import { analyzeArticles, type AnalysisResult } from '../../lib/ai'
import { getAnalyses, submitAnalysis } from '../../lib/api'

export default function Analysis() {
  const [articles, setArticles] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    try {
      const records = await getAnalyses()
      setHistory(records || [])
    } catch {}
  }

  function addArticle() { setArticles([...articles, '']) }
  function removeArticle(index: number) {
    if (articles.length <= 1) return
    setArticles(articles.filter((_, i) => i !== index))
  }
  function updateArticle(index: number, value: string) {
    const updated = [...articles]
    updated[index] = value
    setArticles(updated)
  }

  async function handleAnalyze() {
    const validArticles = articles.filter(a => a.trim().length > 0)
    if (validArticles.length === 0) { setError('请至少粘贴一篇文章内容'); return }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      // AI 分析仍在前端（用户自己的 key）
      const analysisResult = await analyzeArticles(validArticles)
      setResult(analysisResult)

      // 提交到 Worker API（服务端保存 + 自动创建条件单）
      const { createdCount } = await submitAnalysis({
        articles: validArticles,
        market_view: analysisResult.market_view,
        main_sectors: analysisResult.main_sectors,
        core_logic: analysisResult.core_logic,
        etf_mapping: analysisResult.etf_mapping,
        orders: analysisResult.orders,
      })

      await loadHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {articles.map((article, i) => (
          <div key={i} className="relative">
            <textarea
              value={article}
              onChange={e => updateArticle(i, e.target.value)}
              placeholder={`粘贴文章${i + 1}正文（支持 HTML，自动清洗）`}
              className="w-full h-32 px-3 py-2 text-sm border border-gray-200 dark:border-white/[0.06] rounded-xl bg-white dark:bg-[#141416] resize-none shadow-sm"
            />
            {articles.length > 1 && (
              <button onClick={() => removeArticle(i)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-xs">删除</button>
            )}
          </div>
        ))}
        <button onClick={addArticle} className="text-xs text-blue-500 dark:text-blue-400">+ 添加文章</button>
      </div>

      <button onClick={handleAnalyze} disabled={loading} className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
        {loading ? 'AI 分析中...' : 'AI 分析'}
      </button>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {result && (
        <div className="space-y-3">
          {/* Market View */}
          <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400 dark:hidden" />
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-1">大盘观点</p>
            <p className="text-sm text-gray-900 dark:text-white">{result.market_view}</p>
          </div>
          {/* Sectors */}
          <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-400 dark:hidden" />
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-2">主线方向</p>
            <div className="flex flex-wrap gap-1.5">
              {result.main_sectors.map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs rounded-full">{s}</span>
              ))}
            </div>
          </div>
          {/* Core Logic */}
          <div className="rounded-xl p-4 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 dark:hidden" />
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-1">核心逻辑</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{result.core_logic}</p>
          </div>
          {/* Orders */}
          {result.orders.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2">条件单（已自动创建）</p>
              <div className="space-y-2">
                {result.orders.map((order, i) => (
                  <div key={i} className="rounded-xl p-3 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-green-400 dark:hidden" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{order.name}({order.code})</span>
                      <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">买入 @{order.trigger_price}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">仓位{order.position_pct}% | 止损{order.stop_loss_pct}% | 止盈回撤{order.trailing_pct}% | 最长{order.max_hold_days}天</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">{order.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600">
          {showHistory ? '收起历史' : `历史分析 (${history.length})`}
        </button>
        {showHistory && history.length > 0 && (
          <div className="mt-2 space-y-2">
            {history.map((record: any) => (
              <div key={record.id} className="rounded-xl p-3 bg-white dark:bg-[#141416] border border-gray-100 dark:border-white/[0.06] shadow-sm relative overflow-hidden text-xs">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:hidden" />
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400 dark:text-gray-600">{record.created_at?.split('T')[0]}</span>
                  <span className="text-gray-400">{JSON.parse(record.orders || '[]').length} 个条件单</span>
                </div>
                <p className="text-gray-900 dark:text-white">{record.market_view}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {JSON.parse(record.main_sectors || '[]').map((s: string, i: number) => (
                    <span key={i} className="px-1.5 py-0.5 bg-gray-500/10 text-gray-600 dark:text-gray-400 rounded-full text-[10px]">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
