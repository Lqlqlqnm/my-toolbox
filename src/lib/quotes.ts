// 东方财富行情 API — JSONP 方式，浏览器直连无 CORS 问题

// ETF 代码 → secid 映射（1=沪市, 0=深市）
export function getSecId(code: string): string {
  if (code.startsWith('5') || code.startsWith('6')) return `1.${code}` // 沪市
  if (code.startsWith('1') || code.startsWith('0') || code.startsWith('3')) return `0.${code}` // 深市
  return `1.${code}`
}

// JSONP 请求封装
function jsonp<T>(url: string, callbackParam = 'cb'): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackName = `__jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('JSONP timeout'))
    }, 10000)

    function cleanup() {
      clearTimeout(timeout)
      delete (window as Record<string, unknown>)[callbackName]
      script.remove()
    }

    ;(window as Record<string, unknown>)[callbackName] = (data: T) => {
      cleanup()
      resolve(data)
    }

    const script = document.createElement('script')
    script.src = `${url}${url.includes('?') ? '&' : '?'}${callbackParam}=${callbackName}`
    script.onerror = () => { cleanup(); reject(new Error('JSONP load error')) }
    document.body.appendChild(script)
  })
}

export interface QuoteData {
  code: string
  name: string
  price: number
  change: number // 涨跌幅 %
  open: number
  high: number
  low: number
  volume: number
}

// 获取单只 ETF/股票实时报价
export async function fetchQuote(code: string): Promise<QuoteData | null> {
  const secid = getSecId(code)
  try {
    const data = await jsonp<{ data: Record<string, unknown> }>(
      `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f57,f58,f169,f170`
    )
    if (!data?.data) return null
    const d = data.data
    return {
      code: String(d.f57 || code),
      name: String(d.f58 || ''),
      price: Number(d.f43) / 1000,
      change: Number(d.f170) / 100,
      open: Number(d.f46) / 1000,
      high: Number(d.f44) / 1000,
      low: Number(d.f45) / 1000,
      volume: Number(d.f47),
    }
  } catch {
    return null
  }
}

// 批量获取报价
export async function fetchQuotes(codes: string[]): Promise<Record<string, QuoteData>> {
  const results: Record<string, QuoteData> = {}
  // 东方财富单次可批量查，但为了简单先逐个查（个人用量小）
  await Promise.all(
    codes.map(async (code) => {
      const quote = await fetchQuote(code)
      if (quote) results[code] = quote
    })
  )
  return results
}

// 获取 K 线数据
export interface KLineData {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

export async function fetchKLine(code: string, days = 30): Promise<KLineData[]> {
  const secid = getSecId(code)
  try {
    const data = await jsonp<{ data: { klines: string[] } }>(
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&beg=0&end=20500101&lmt=${days}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57`
    )
    if (!data?.data?.klines) return []
    return data.data.klines.map(line => {
      const [date, open, close, high, low, volume] = line.split(',')
      return { date, open: +open, close: +close, high: +high, low: +low, volume: +volume }
    })
  } catch {
    return []
  }
}
