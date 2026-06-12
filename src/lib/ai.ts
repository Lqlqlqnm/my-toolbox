// AI 分析工具 — 前端直连用户自填的 API

export interface AIConfig {
  apiKey: string
  baseUrl: string
  model: string
}

// 从 localStorage 读取 AI 配置
export function getAIConfig(): AIConfig | null {
  const saved = localStorage.getItem('ai_config')
  if (!saved) return null
  try {
    const config = JSON.parse(saved)
    if (!config.apiKey) return null
    return config
  } catch { return null }
}

export function saveAIConfig(config: AIConfig) {
  localStorage.setItem('ai_config', JSON.stringify(config))
}

// HTML 清洗：提取纯文本
export function extractText(input: string): string {
  // 检测是否包含 HTML 标签
  if (/<[a-z][\s\S]*>/i.test(input)) {
    const doc = new DOMParser().parseFromString(input, 'text/html')
    // 移除 script/style
    doc.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove())
    return doc.body.innerText.replace(/\n{3,}/g, '\n\n').trim()
  }
  return input.trim()
}

// 调用 AI 分析多篇文章
export interface AnalysisResult {
  market_view: string
  main_sectors: string[]
  core_logic: string
  etf_mapping: Record<string, string[]>
  orders: Array<{
    code: string
    name: string
    direction: 'buy'
    trigger_price: number
    position_pct: number
    stop_loss_pct: number
    trailing_pct: number
    activation_pct: number
    max_hold_days: number
    reason: string
  }>
}

// 图片输入项
export interface ImageInput {
  base64: string
  mime_type: string
}

export async function analyzeArticles(articles: string[], images: ImageInput[] = []): Promise<AnalysisResult> {
  const config = getAIConfig()
  if (!config) throw new Error('请先在设置中配置 AI API Key')

  const cleanedArticles = articles.map(extractText).filter(Boolean)
  if (cleanedArticles.length === 0 && images.length === 0) throw new Error('请至少提供一篇文章内容或一张图片')

  const systemPrompt = `你是一位专业的ETF投资策略分析师，擅长从公众号文章中提取投资方向和交易信号。

请分析用户提供的文章（文字和/或图片截图），输出以下结构化JSON（不要输出其他内容）：
{
  "market_view": "看多/震荡/看空 + 一句话理由",
  "main_sectors": ["主线方向1", "主线方向2"],
  "core_logic": "核心逻辑一段话概述",
  "etf_mapping": {
    "方向名": ["ETF代码1", "ETF代码2"]
  },
  "orders": [
    {
      "code": "ETF代码(6位数字)",
      "name": "ETF名称",
      "direction": "buy",
      "trigger_price": 1.234,
      "position_pct": 20,
      "stop_loss_pct": 5,
      "trailing_pct": 3,
      "activation_pct": 8,
      "max_hold_days": 15,
      "reason": "买入理由"
    }
  ]
}

参数说明与要求：
- code: ETF代码为6位数字（如510300、159919）
- direction: 固定为 "buy"（卖出由系统规则自动管理）
- trigger_price: 建议买入触发价位
- position_pct: 建议仓位百分比（5-30）
- stop_loss_pct: 止损比例，宽基ETF给3-5%，行业ETF给5-8%
- trailing_pct: 移动止盈回撤比例，宽基ETF给3%，行业ETF给4-5%
- activation_pct: 移动止盈启动门槛，信号强给8-15%，信号弱给5-8%
- max_hold_days: 最大持仓天数，短期逻辑给5-10天，中期逻辑给10-20天
- reason: 一句话说明买入理由

注意：
- 请根据ETF品种特性（宽基vs行业vs跨境）灵活调整参数
- 信号越强，activation_pct越高（给更多上涨空间），trailing_pct越宽（容忍更大回撤）
- 如果文章没有明确交易信号，orders 可以为空数组
- 请基于文章内容给出合理判断，不要编造
- 如果输入包含图片，请先识别图片中的文字内容再进行分析`

  // Build multimodal content array
  const userContent: any[] = []

  // Add text articles
  if (cleanedArticles.length > 0) {
    const articleTexts = cleanedArticles.map((text, i) =>
      `【文章${i + 1}】\n${text.substring(0, 4000)}`
    ).join('\n\n---\n\n')
    userContent.push({ type: 'text', text: articleTexts })
  }

  // Add images
  for (const img of images) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${img.mime_type};base64,${img.base64}` },
    })
  }

  // If only images, add a text prompt
  if (cleanedArticles.length === 0 && images.length > 0) {
    userContent.unshift({ type: 'text', text: '请识别并分析以下图片中的文章内容：' })
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI 请求失败: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 返回为空')

  try {
    // Strip markdown code fences if present (```json ... ```)
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    return JSON.parse(jsonStr) as AnalysisResult
  } catch {
    throw new Error('AI 返回格式错误')
  }
}
