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
              className="w-full h-32 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 resize-none"
            />
            {articles.length > 1 && (
              <button onClick={() => removeArticle(i)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-xs">删除</button>
            )}
          </div>
        ))}
        <button onClick={addArticle} className="text-sm text-blue-500 hover:text-blue-600">+ 添加文章</button>
      </div>

      <button onClick={handleAnalyze} disabled={loading} className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
        {loading ? 'AI 分析中...' : 'AI 分析'}
      </button>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {result && (
        <div className="space-y-3 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-1">大盘观点</h3>
            <p className="text-sm text-gray-800 dark:text-gray-200">{result.market_view}</p>
          </div>
          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-1">主线方向</h3>
            <div className="flex flex-wrap gap-1">
              {result.main_sectors.map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-1">核心逻辑</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">{result.core_logic}</p>
          </div>
          {result.orders.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-2">条件单（已自动创建）</h3>
              <div className="space-y-2">
                {result.orders.map((order, i) => (
                  <div key={i} className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{order.name}({order.code})</span>
                      <span className="text-green-600">买入 @{order.trigger_price}</span>
                    </div>
                    <div className="text-gray-500">仓位{order.position_pct}% | 止损{order.stop_loss_pct}% | 止盈回撤{order.trailing_pct}% | 最长{order.max_hold_days}天</div>
                    <div className="text-gray-500">{order.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-gray-500 hover:text-gray-700">
          {showHistory ? '收起历史' : `历史分析 (${history.length})`}
        </button>
        {showHistory && history.length > 0 && (
          <div className="mt-2 space-y-2">
            {history.map((record: any) => (
              <div key={record.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">{record.created_at?.split('T')[0]}</span>
                  <span className="text-gray-400">{JSON.parse(record.orders || '[]').length} 个条件单</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300">{record.market_view}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {JSON.parse(record.main_sectors || '[]').map((s: string, i: number) => (
                    <span key={i} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">{s}</span>
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
