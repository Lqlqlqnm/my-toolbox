import {
  UtensilsCrossed, TrainFront, ShoppingCart, Droplets, Clapperboard,
  Home, Pill, BookOpen, Gift, Pin, Coffee, Beer, Cat, Scissors,
  Dumbbell, Smartphone, Car, Plane, Music, Shirt, Coins, Trophy,
  TrendingUp, Landmark, ClipboardList, Briefcase, Gamepad2, Palmtree,
  Wallet, CreditCard, Banknote, Target, GraduationCap, Gem, Laptop,
  type LucideIcon,
} from 'lucide-react'

// Map icon keys to Lucide components
const iconMap: Record<string, LucideIcon> = {
  food: UtensilsCrossed,
  transit: TrainFront,
  shopping: ShoppingCart,
  personal: Droplets,
  movie: Clapperboard,
  house: Home,
  medical: Pill,
  book: BookOpen,
  gift: Gift,
  pin: Pin,
  coffee: Coffee,
  beer: Beer,
  pet: Cat,
  haircut: Scissors,
  fitness: Dumbbell,
  phone: Smartphone,
  car: Car,
  flight: Plane,
  music: Music,
  clothing: Shirt,
  money: Coins,
  trophy: Trophy,
  invest: TrendingUp,
  bonus: Landmark,
  bills: ClipboardList,
  work: Briefcase,
  game: Gamepad2,
  vacation: Palmtree,
  // Account icons
  cash: Banknote,
  debit: CreditCard,
  credit: Wallet,
  ewallet: Smartphone,
  // Savings goal icons
  target: Target,
  graduation: GraduationCap,
  ring: Gem,
  laptop: Laptop,
}

// All category icon keys in display order
export const categoryIconKeys = [
  'food', 'transit', 'shopping', 'personal', 'movie', 'house', 'medical',
  'book', 'gift', 'pin', 'coffee', 'beer', 'pet', 'haircut', 'fitness',
  'phone', 'car', 'flight', 'music', 'clothing', 'money', 'trophy',
  'invest', 'bonus', 'bills', 'work', 'game', 'vacation',
]

// Account icon keys
export const accountIconKeys = ['cash', 'debit', 'credit', 'ewallet']

// Savings goal icon keys
export const goalIconKeys = [
  'target', 'house', 'car', 'flight', 'laptop', 'phone',
  'clothing', 'ring', 'graduation', 'vacation', 'game', 'money',
]

// Icon key to Chinese label (for select options)
export const iconLabels: Record<string, string> = {
  food: '餐饮', transit: '交通', shopping: '购物', personal: '日用',
  movie: '娱乐', house: '住房', medical: '医疗', book: '教育',
  gift: '礼物', pin: '其他', coffee: '咖啡', beer: '酒饮',
  pet: '宠物', haircut: '美容', fitness: '健身', phone: '数码',
  car: '用车', flight: '出行', music: '音乐', clothing: '服饰',
  money: '收入', trophy: '奖金', invest: '投资', bonus: '红包',
  bills: '账单', work: '工作', game: '游戏', vacation: '度假',
  cash: '现金', debit: '储蓄卡', credit: '信用卡', ewallet: '钱包',
  target: '目标', graduation: '学业', ring: '珠宝', laptop: '电脑',
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

  const IconComponent = iconMap[icon]
  if (!IconComponent) {
    return <span className={className} style={{ fontSize: size * 0.9 }}>{icon}</span>
  }

  return <IconComponent size={size} strokeWidth={1.75} className={className} />
}
