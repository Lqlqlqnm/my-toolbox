// 技术面分析模块：K线获取 + 支撑阻力位计算 + 量价信号检测

interface KLineBar {
  day: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface PriceLevels {
  currentPrice: number
  ma5: number
  recentHigh: number
  recentLow: number
  dipBuy: number       // 回调买入位（日内低点附近）
  dipBuy2: number      // 深度支撑位（近期低点附近）
  breakoutBuy: number  // 突破买入位（近期高点上方）
}

interface Signal {
  name: string
  strength: 'strong' | 'medium' | 'weak'
  trigger_price: number
  description: string
}

interface TechnicalResult {
  code: string
  name: string
  levels: PriceLevels
  signals: Signal[]
  suggested_trigger: number // 系统建议的触发价
  trigger_reason: string
}

// ===== K线获取（新浪财经，10日日K） =====

async function fetchKLine(code: string): Promise<KLineBar[]> {
  const market = code.startsWith('5') || code.startsWith('6') ? 'sh' : 'sz'
  const symbol = `${market}${code}`

  // 使用新浪分钟级数据汇总，或直接拉日K
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=240&ma=5&datalen=15`

  const resp = await fetch(url, {
    headers: { 'Referer': 'https://finance.sina.com.cn/' },
  })

  if (!resp.ok) return []
  const text = await resp.text()

  try {
    const data = JSON.parse(text) as Array<{
      day: string; open: string; high: string; low: string; close: string; volume: string; ma_price5?: string
    }>
    return data.map(d => ({
      day: d.day,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: parseInt(d.volume),
    }))
  } catch {
    return []
  }
}

// ===== 支撑阻力位计算 =====

function calculateLevels(bars: KLineBar[]): PriceLevels | null {
  if (bars.length < 5) return null

  const recent = bars.slice(-10)
  const last = recent[recent.length - 1]
  const currentPrice = last.close

  // MA5
  const last5 = bars.slice(-5)
  const ma5 = last5.reduce((s, b) => s + b.close, 0) / 5

  // 近期高低点
  const recentHigh = Math.max(...recent.map(b => b.high))
  const recentLow = Math.min(...recent.map(b => b.low))

  // 回调买入位：今日低点稍下方
  const dipBuy = Math.round(last.low * 0.995 * 1000) / 1000

  // 深度支撑位：近期低点附近
  const dipBuy2 = Math.round(recentLow * 1.002 * 1000) / 1000

  // 突破买入位：近期高点上方
  const breakoutBuy = Math.round(recentHigh * 1.005 * 1000) / 1000

  return { currentPrice, ma5, recentHigh, recentLow, dipBuy, dipBuy2, breakoutBuy }
}

// ===== 信号检测 =====

function detectSignals(bars: KLineBar[]): Signal[] {
  if (bars.length < 10) return []
  const signals: Signal[] = []

  const last = bars[bars.length - 1]
  const last5 = bars.slice(-5)
  const ma5 = last5.reduce((s, b) => s + b.close, 0) / 5
  const avgVol5 = last5.reduce((s, b) => s + b.volume, 0) / 5

  // 信号1：放量突破回踩MA5
  // 近5天内有一天涨幅>=3%且量>=2倍均量，之后回踩到MA5附近
  for (let i = bars.length - 5; i < bars.length - 1; i++) {
    const bar = bars[i]
    const prevBar = bars[i - 1]
    if (!prevBar) continue
    const gain = (bar.close - prevBar.close) / prevBar.close
    if (gain >= 0.03 && bar.volume >= avgVol5 * 2) {
      // 检查当前价是否回踩到MA5附近（±1.5%）
      const distToMa5 = Math.abs(last.close - ma5) / ma5
      if (distToMa5 < 0.015 && last.close >= ma5 * 0.995) {
        signals.push({
          name: '放量突破回踩',
          strength: gain >= 0.05 ? 'strong' : 'medium',
          trigger_price: Math.round(ma5 * 0.998 * 1000) / 1000,
          description: `近期放量上涨${(gain * 100).toFixed(1)}%后回踩5日均线`,
        })
        break
      }
    }
  }

  // 信号2：缩量企稳
  // 近期有放量日，之后量缩至不足50%，价格企稳在MA5附近
  const recentBars = bars.slice(-7)
  const maxVolBar = recentBars.reduce((max, b) => b.volume > max.volume ? b : max, recentBars[0])
  if (maxVolBar.volume >= avgVol5 * 1.8) {
    const maxVolIdx = recentBars.indexOf(maxVolBar)
    if (maxVolIdx < recentBars.length - 2) {
      // 放量后的bar
      const afterBars = recentBars.slice(maxVolIdx + 1)
      const shrunk = afterBars.every(b => b.volume < maxVolBar.volume * 0.5)
      const nearMa5 = Math.abs(last.close - ma5) / ma5 < 0.015
      if (shrunk && nearMa5) {
        signals.push({
          name: '缩量企稳',
          strength: 'medium',
          trigger_price: Math.round(last.low * 0.998 * 1000) / 1000,
          description: '放量后缩量整理，价格企稳于均线附近',
        })
      }
    }
  }

  // 信号3：恐慌不创新低
  // 昨天大跌（>=2%）或长上影，今天守住昨天低点
  if (bars.length >= 2) {
    const yesterday = bars[bars.length - 2]
    const prevClose = bars.length >= 3 ? bars[bars.length - 3].close : yesterday.open
    const yDrop = (yesterday.close - prevClose) / prevClose
    const yBody = Math.abs(yesterday.close - yesterday.open)
    const yUpperShadow = yesterday.high - Math.max(yesterday.close, yesterday.open)

    const isPanic = yDrop <= -0.02 || yUpperShadow >= yBody * 2

    if (isPanic && last.low >= yesterday.low * 0.998 && last.close > yesterday.low) {
      signals.push({
        name: '恐慌不创新低',
        strength: yDrop <= -0.03 ? 'strong' : 'medium',
        trigger_price: Math.round(yesterday.low * 1.002 * 1000) / 1000,
        description: `昨日恐慌下跌${(yDrop * 100).toFixed(1)}%，今日守住低点`,
      })
    }
  }

  return signals
}

// ===== 综合计算：为单个ETF生成技术面建议 =====

export async function analyzeTechnical(code: string, name: string): Promise<TechnicalResult | null> {
  const bars = await fetchKLine(code)
  if (bars.length < 5) return null

  const levels = calculateLevels(bars)
  if (!levels) return null

  const signals = detectSignals(bars)

  // 决定建议触发价
  let suggested_trigger: number
  let trigger_reason: string

  if (signals.length > 0) {
    // 有信号：使用最强信号的触发价
    const best = signals.sort((a, b) => {
      const rank = { strong: 3, medium: 2, weak: 1 }
      return rank[b.strength] - rank[a.strength]
    })[0]
    suggested_trigger = best.trigger_price
    trigger_reason = `${best.name}(${best.strength}) — ${best.description}`
  } else {
    // 无信号：使用回调买入位（今日低点稍下方）
    suggested_trigger = levels.dipBuy
    trigger_reason = `无明确信号，挂单于日内低点下方(¥${levels.dipBuy})`
  }

  return { code, name, levels, signals, suggested_trigger, trigger_reason }
}

// ===== 批量分析 =====

export async function analyzeMultiple(etfs: Array<{ code: string; name: string }>): Promise<TechnicalResult[]> {
  const results: TechnicalResult[] = []
  await Promise.all(
    etfs.map(async ({ code, name }) => {
      const r = await analyzeTechnical(code, name)
      if (r) results.push(r)
    })
  )
  return results
}
