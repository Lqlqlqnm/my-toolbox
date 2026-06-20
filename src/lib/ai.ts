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
  risk_level: 'low' | 'medium' | 'high'
  risk_reason: string
  etf_recommendations: Array<{
    code: string
    name: string
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

// Helper: Compress image to ensure base64 stays under maxBytes (default 4.5MB to stay safe under 5MB API limit)
async function compressImage(base64: string, mimeType: string, maxBytes = 4.5 * 1024 * 1024): Promise<{ base64: string; mime_type: string }> {
  // Check if already small enough
  const currentBytes = base64.length * 0.75 // base64 → bytes approximation
  if (currentBytes <= maxBytes) return { base64, mime_type: mimeType }

  // Decode and draw to canvas to resize
  const img = new Image()
  const dataUrl = `data:${mimeType};base64,${base64}`
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = dataUrl
  })

  let { width, height } = img
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Iteratively reduce size until under limit
  let quality = 0.8
  let scale = 1
  let result = base64

  for (let attempt = 0; attempt < 5; attempt++) {
    const newW = Math.floor(width * scale)
    const newH = Math.floor(height * scale)
    canvas.width = newW
    canvas.height = newH
    ctx.drawImage(img, 0, 0, newW, newH)

    const compressed = canvas.toDataURL('image/jpeg', quality).split(',')[1]
    if (compressed.length * 0.75 <= maxBytes) {
      return { base64: compressed, mime_type: 'image/jpeg' }
    }
    result = compressed
    scale *= 0.7
    quality = Math.max(0.5, quality - 0.1)
  }

  return { base64: result, mime_type: 'image/jpeg' }
}

export async function analyzeArticles(articles: string[], images: ImageInput[] = []): Promise<AnalysisResult> {
  const config = getAIConfig()
  if (!config) throw new Error('请先在设置中配置 AI API Key')

  const cleanedArticles = articles.map(extractText).filter(Boolean)
  if (cleanedArticles.length === 0 && images.length === 0) throw new Error('请至少提供一篇文章内容或一张图片')

  const systemPrompt = `你是一位专业的A股场内ETF投资策略分析师，擅长从公众号文章中提取投资方向和交易信号。

## 你的任务
分析用户提供的文章（文字和/或图片截图），判断市场方向和推荐的ETF品种。
注意：你只负责判断"买什么"和"为什么买"，具体买入价格由系统根据技术面自动计算，你不需要给出价格。

## ETF代码对照表（必须从此表中选取，不得自行编造代码）

### 宽基指数
510050 上证50ETF | 510300 沪深300ETF | 510500 中证500ETF | 512100 中证1000ETF
159915 创业板ETF | 159949 创业板50ETF | 588000 科创50ETF | 588060 科创100ETF
159852 中证A50ETF | 563000 中证2000ETF | 512050 A500ETF

### 金融
510230 金融ETF | 512800 银行ETF | 512880 证券ETF | 512070 保险ETF
159841 证券ETF | 515020 券商ETF

### 科技/半导体
159995 芯片ETF | 512480 半导体ETF | 561980 半导体设备ETF
512720 计算机ETF | 515230 软件ETF | 515880 通信ETF | 515050 5GETF
516520 智能驾驶ETF

### AI/数字经济
515070 人工智能ETF | 159819 人工智能ETF | 562800 数据ETF | 159786 云计算ETF
516010 算力ETF | 588790 科创AIETF | 515000 科技ETF

### 新能源
515030 新能源车ETF | 516160 新能源ETF | 515790 光伏ETF | 159812 光伏50ETF
159625 绿色电力ETF | 159611 电力ETF | 516580 储能ETF

### 医药/医疗
512010 医药ETF | 512170 医疗ETF | 159992 创新药ETF | 515120 医药50ETF
159828 中药ETF | 516820 生物科技ETF | 512290 生物医药ETF

### 消费
512690 酒ETF | 515170 食品饮料ETF | 159996 家电ETF | 510150 消费ETF
515650 消费50ETF | 159928 消费ETF

### 军工/航天
512660 军工ETF | 512810 军工龙头ETF | 515760 航天军工ETF | 516110 军工ETF

### 有色/贵金属
512400 有色金属ETF | 516780 稀土ETF | 159880 有色60ETF
518880 黄金ETF | 159934 黄金ETF | 517520 黄金股ETF | 518800 黄金基金ETF
560860 工业有色ETF

### 周期/资源
515220 煤炭ETF | 515210 钢铁ETF | 159870 化工ETF | 159930 能源ETF
516220 化工龙头ETF | 510410 资源ETF

### 房地产/基建
159768 房地产ETF | 512200 房地产ETF | 159707 地产ETF | 516950 基建ETF

### 交通/物流
516260 物流ETF | 159666 旅游ETF | 159766 旅游ETF

### 农业
159825 农业ETF

### 红利/价值
510880 红利ETF | 515180 红利ETF | 563020 央企红利ETF | 159581 中证红利ETF

### 港股/跨境
513060 恒生医疗ETF | 513180 恒生科技ETF | 513330 恒生互联网ETF
159605 中概互联网ETF | 513050 中概互联ETF | 510900 恒生中国企业ETF
513130 恒生科技30ETF | 159607 纳斯达克ETF | 513100 纳指ETF | 159941 标普500ETF

## 输出格式（纯JSON，不要markdown代码块）
{
  "market_view": "看多/震荡/看空 + 一句话理由",
  "main_sectors": ["主线方向1", "主线方向2"],
  "core_logic": "核心逻辑一段话概述",
  "risk_level": "low/medium/high",
  "risk_reason": "风险评级理由",
  "etf_recommendations": [
    {
      "code": "ETF代码(6位数字，必须从上表选取)",
      "name": "ETF名称（必须与上表一致）",
      "position_pct": 15,
      "stop_loss_pct": 5,
      "trailing_pct": 4,
      "activation_pct": 8,
      "max_hold_days": 15,
      "reason": "推荐理由"
    }
  ]
}

## 参数说明
- code: 必须从上方ETF代码对照表中选取，严禁编造不在表中的代码
- position_pct: 建议仓位百分比（5-25），风险越高给越低
- stop_loss_pct: 止损比例，宽基ETF给3-5%，行业ETF给5-8%
- trailing_pct: 移动止盈回撤比例，宽基ETF给3%，行业ETF给4-5%
- activation_pct: 移动止盈启动门槛，信号强给8-15%，信号弱给5-8%
- max_hold_days: 最大持仓天数，短期逻辑给5-10天，中期逻辑给10-20天
- reason: 一句话说明推荐理由

## 风险评级标准
- low: 板块已充分调整（距高点>15%），估值合理
- medium: 板块小幅调整（距高点5-15%），短期有波动
- high: 板块接近高点（距高点<5%），追入风险大

## 注意
- 最多推荐3-4只最相关的ETF
- 如果文章没有明确交易信号，etf_recommendations 可以为空数组
- 请基于文章内容给出合理判断，不要编造
- 如果文章有营销号/杀猪盘特征，risk_level设为high并在risk_reason中说明
- 如果输入包含图片，请先识别图片中的文字内容再进行分析
- 如果文章提到的行业在表中没有精确对应的ETF，选最接近的或不推荐`

  // Build multimodal content array
  const userContent: any[] = []

  // Add text articles
  if (cleanedArticles.length > 0) {
    const articleTexts = cleanedArticles.map((text, i) =>
      `【文章${i + 1}】\n${text.substring(0, 4000)}`
    ).join('\n\n---\n\n')
    userContent.push({ type: 'text', text: articleTexts })
  }

  // Add images (compressed if needed)
  for (const img of images) {
    const compressed = await compressImage(img.base64, img.mime_type)
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${compressed.mime_type};base64,${compressed.base64}` },
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
    const result = JSON.parse(jsonStr) as AnalysisResult

    // 验证 ETF 代码：调东方财富 API 确认代码真实存在，用实际名称替换
    if (result.etf_recommendations && result.etf_recommendations.length > 0) {
      const { fetchQuote } = await import('./quotes')
      const verified: typeof result.etf_recommendations = []
      for (const rec of result.etf_recommendations) {
        try {
          const quote = await fetchQuote(rec.code)
          if (quote && quote.name && quote.price > 0) {
            // 代码有效，用 API 返回的真实名称覆盖
            rec.name = quote.name
            verified.push(rec)
          }
          // quote 为 null 或 price 为 0 说明代码无效，丢弃
        } catch {
          // API 查询失败（网络问题），保留但标记待验证
          rec.name = `${rec.name}(待验证)`
          verified.push(rec)
        }
      }
      result.etf_recommendations = verified
    }

    return result
  } catch (e) {
    if (e instanceof Error && e.message.includes('AI')) throw e
    throw new Error('AI 返回格式错误')
  }
}
