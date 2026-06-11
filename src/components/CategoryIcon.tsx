// Map old Lucide icon keys to new SVG filenames
const legacyKeyMap: Record<string, { file: string; dir: string }> = {
  food: { file: 'dining', dir: 'expense' },
  transit: { file: 'subway', dir: 'expense' },
  shopping: { file: 'shopping', dir: 'expense' },
  personal: { file: 'daily-necessities', dir: 'expense' },
  movie: { file: 'entertainment', dir: 'expense' },
  house: { file: 'housing', dir: 'expense' },
  medical: { file: 'medical', dir: 'expense' },
  book: { file: 'education', dir: 'expense' },
  gift: { file: 'gift', dir: 'expense' },
  pin: { file: 'office', dir: 'expense' },
  coffee: { file: 'coffee', dir: 'expense' },
  beer: { file: 'alcohol', dir: 'expense' },
  pet: { file: 'pet', dir: 'expense' },
  haircut: { file: 'beauty', dir: 'expense' },
  fitness: { file: 'fitness', dir: 'expense' },
  phone: { file: 'phone', dir: 'expense' },
  car: { file: 'taxi', dir: 'expense' },
  flight: { file: 'flight', dir: 'expense' },
  music: { file: 'entertainment', dir: 'expense' },
  clothing: { file: 'clothing', dir: 'expense' },
  money: { file: 'salary', dir: 'income' },
  trophy: { file: 'bonus', dir: 'income' },
  invest: { file: 'investment-return', dir: 'income' },
  bonus: { file: 'red-envelope', dir: 'income' },
  bills: { file: 'utilities', dir: 'expense' },
  work: { file: 'office', dir: 'expense' },
  game: { file: 'game', dir: 'expense' },
  vacation: { file: 'travel', dir: 'expense' },
  // Account icons
  cash: { file: 'cash', dir: 'finance' },
  debit: { file: 'deposit', dir: 'finance' },
  credit: { file: 'credit-card', dir: 'finance' },
  ewallet: { file: 'wechat-pay', dir: 'bank' },
  // Savings goal icons
  target: { file: 'fund', dir: 'finance' },
  graduation: { file: 'education', dir: 'expense' },
  ring: { file: 'gift', dir: 'expense' },
  laptop: { file: 'digital', dir: 'expense' },
}

// New icon keys that map directly to SVG filenames
const expenseIcons = [
  'dining', 'subway', 'shopping', 'daily-necessities', 'entertainment',
  'housing', 'medical', 'education', 'gift-money', 'office', 'coffee',
  'alcohol', 'pet', 'beauty', 'fitness', 'phone', 'taxi', 'flight',
  'clothing', 'game', 'travel', 'digital', 'snack', 'takeout',
  'movie', 'bus', 'train', 'parking', 'gas', 'grocery', 'fruit',
  'subscription', 'insurance', 'mortgage', 'utilities', 'repair',
  'childcare', 'social', 'hotel', 'delivery', 'internet', 'fine',
  'breakfast', 'bike', 'supermarket', 'banquet', 'cosmetics',
  'home', 'property-fee', 'fitness', 'gift',
]

const incomeIcons = [
  'salary', 'bonus', 'investment-return', 'red-envelope',
  'reimbursement', 'side-business', 'rental', 'interest',
  'lottery', 'parttime', 'refund', 'second-hand',
]

const bankIcons = [
  'wechat-pay', 'alipay', 'icbc', 'ccb', 'abc', 'boc', 'bocom',
  'cmb', 'cib', 'cmbc', 'spdb', 'citic', 'ceb', 'hxb', 'pab',
  'psbc', 'cgb', 'nbcb', 'bosc', 'bob', 'webank', 'mybank',
  'unionpay', 'jd-pay', 'douyin-pay', 'meituan-pay', 'huabao-zhitou',
]

const financeIcons = [
  'cash', 'credit-card', 'deposit', 'fund', 'stock',
  'wealth', 'housing-fund', 'huabei',
]

// All category icon keys in display order (for icon picker)
export const categoryIconKeys = [
  '🍜', '🚇', '🛒', '🧴', '🎬', '🏠', '💊', '📚', '🎁', '📌',
  '☕', '🍺', '🐱', '💄', '🏋️', '📱', '🚕', '✈️', '👔', '🎮',
  '🧳', '💻', '🍿', '🥡', '🎬', '🚌', '🚄', '🅿️', '⛽', '🥬',
  '🍎', '📺', '🛡️', '🏦', '💡', '🔧', '👶', '🍻', '🏨', '📦',
]
export const incomeIconKeys = [
  '💰', '🏆', '📈', '🧧', '📋', '💼', '🏘️', '💵', '🎰', '👨‍💻', '↩️', '♻️',
]
export const accountIconKeys = [...bankIcons, ...financeIcons]
export const goalIconKeys = ['fund', 'housing', 'taxi', 'flight', 'digital', 'phone', 'clothing', 'gift', 'education', 'travel', 'game', 'salary']

// Icon key to Chinese label (for select options)
export const iconLabels: Record<string, string> = {
  dining: '餐饮', subway: '交通', shopping: '购物', 'daily-necessities': '日用',
  entertainment: '娱乐', housing: '住房', medical: '医疗', education: '教育',
  'gift-money': '人情', office: '其他', coffee: '咖啡', alcohol: '酒饮',
  pet: '宠物', beauty: '美容', fitness: '健身', phone: '通讯',
  taxi: '打车', flight: '机票', clothing: '服饰', game: '游戏',
  travel: '旅行', digital: '数码', snack: '零食', takeout: '外卖',
  movie: '电影', bus: '公交', train: '火车', parking: '停车',
  gas: '加油', grocery: '买菜', fruit: '水果', subscription: '订阅',
  insurance: '保险', mortgage: '房贷', utilities: '水电', repair: '维修',
  salary: '工资', bonus: '奖金', 'investment-return': '理财',
  'red-envelope': '红包', reimbursement: '报销', 'side-business': '副业',
  rental: '房租收入', interest: '利息', lottery: '彩票', parttime: '兼职',
  cash: '现金', 'credit-card': '信用卡', deposit: '储蓄',
  'wechat-pay': '微信', alipay: '支付宝', icbc: '工商', ccb: '建设',
  abc: '农业', boc: '中国', bocom: '交通', cmb: '招商',
  fund: '基金', stock: '股票', wealth: '理财', 'housing-fund': '公积金',
}

function getIconDir(icon: string): string {
  if (incomeIcons.includes(icon)) return 'icons-income'
  if (bankIcons.includes(icon)) return 'icons-bank'
  if (financeIcons.includes(icon)) return 'icons-finance'
  return 'icons-expense'
}

interface CategoryIconProps {
  icon: string
  size?: number
  className?: string
}

// Check if a string is an emoji (legacy data)
function isEmoji(str: string): boolean {
  return /^\p{Emoji}/u.test(str)
}

export default function CategoryIcon({ icon, size = 20, className = '' }: CategoryIconProps) {
  // Handle legacy emoji data
  if (isEmoji(icon)) {
    return <span className={className} style={{ fontSize: size * 0.9 }}>{icon}</span>
  }

  // Map old Lucide keys to new SVG filenames
  const mapped = legacyKeyMap[icon]
  const fileName = mapped ? mapped.file : icon
  const dir = mapped ? `icons-${mapped.dir}` : getIconDir(icon)

  return (
    <img
      src={`/${dir}/${fileName}.svg`}
      alt={icon}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}
