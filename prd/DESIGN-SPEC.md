# My Toolbox 设计规范总结

## 设计定位

iOS 26 风格 + 未来感 + 高级感，莫兰迪低饱和色系为基底，重点内容用相对突出的色彩。适用于 PWA 应用。

---

## 核心原则

### 1. 功能决定布局，不是模板决定布局

每个页面的核心场景不同，布局必须围绕该页面的"用户第一眼想看到什么"来设计：

- **条件单** → 用巨型数字（"4 等待触发"）直接回答"有多少在监控"
- **记账统计** → 趋势对比是主角（本月 vs 上月变化百分比）
- **食材库存** → 过期紧迫感是核心（警告横幅 + 倒计时标签）
- **习惯打卡** → 连续天数 + 热力图驱动坚持动力
- **储物定位** → 搜索框最突出（核心用例是"找东西"）
- **订阅管理** → 月度总花费是焦点（"每月花多少"）

### 2. 信息层级：大数字 > 图表 > 列表

- 页面最重要的信息用 **36-64px 超大字重数字** 表达
- 次要信息用 **可视化**（条形图、比例条、热力图）
- 详情用 **卡片列表**

### 3. 不要平铺，要有主次

拒绝把所有信息等权重平铺。一个页面只有一个视觉焦点（通常是顶部的 Hero 区域或数据卡片）。

---

## 色彩体系

### 浅色模式
- 背景：`#f6f4f1`（暖灰白）
- 卡片：`#fff` + `border: 0.5px solid rgba(0,0,0,0.04)` + 轻阴影
- 主文字：`#1a1816`
- 次文字：`#9a9590` / `#b0aaa5`
- 深色数据卡片背景：渐变深色（如 `#3d5a6e → #2a4254`）

### 深色模式
- 背景：`#111110`（接近纯黑的暖黑）
- 卡片：`rgba(255,255,255,0.02)` + `border: 0.5px solid rgba(255,255,255,0.05)`
- 主文字：`#f0ece8`
- 次文字：`#5a5550` / `#4a4540`

### 各模块主题色

| 模块 | 浅色主题色 | 深色主题色 |
|------|-----------|-----------|
| ETF 策略助手 | `#3d6b55` 墨绿 | `#7aba95` 浅绿 |
| 记账本 | `#8a6d3b` 暖金 | `#c8a960` 亮金 |
| 旅行清单 | `#4a8a6a` 森绿 | `#7aba95` |
| 相关性发现器 | `#5a7a9a` 蓝灰 | `#8aafc8` 浅蓝 |
| 订阅管理 | `#8a6d9a` 紫灰 | `#c8a0e0` 浅紫 |
| 储物定位 | `#6a8a9a` 灰蓝 | `#8aafc8` |
| 食材库存 | `#5a8a4a` 草绿 | `#8aba7a` |
| 习惯打卡 | `#5a8a5a` 绿 | `#7aba7a` |
| 身体档案 | `#7a8a6a` 灰绿 | `#8aba7a` |
| 年报 | `#6a5090` 深紫 | `#c8a0e0` |

### 功能性色彩
- 收入/正向：`#7aba95`（浅）/ `#5ab87a`（深）
- 支出/警告：`#c87a7a`（浅）/ `#d88a7a`（深）
- 紧急/过期：`#a0503a`（浅）/ `#d88a70`（深）

---

## 组件规范

### iPhone 外壳（原型展示用）
```css
width: 393px; height: 852px; border-radius: 55px;
/* Dynamic Island */
::before { width: 126px; height: 37px; border-radius: 20px; top: 12px; }
/* Home Indicator */
width: 134px; height: 5px; bottom: 8px;
```

### 底部 Tab Bar（PWA 用，不支持左右滑动）
```css
position: absolute; bottom: 20px; left: 24px; right: 24px;
padding: 10px 4px; border-radius: 16px;
/* 浅色 */
background: rgba(255,255,255,0.72);
backdrop-filter: blur(24px);
border: 0.5px solid rgba(255,255,255,0.8);
/* 深色 */
background: rgba(30,30,28,0.8);
border: 0.5px solid rgba(255,255,255,0.06);
```

Tab Item：`font-size: 12px; padding: 6px 12px; border-radius: 10px;`
无图标，纯文字。Active 状态加背景色。

### Hero 区域
```css
.hero-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
.hero-title { font-size: 28-32px; font-weight: 800; letter-spacing: -0.8 to -1px; }
```

### 卡片
- 圆角：`18-22px`
- 内边距：`18-24px`
- 浅色：白底 + 0.5px border + 轻阴影
- 深色：`rgba(255,255,255,0.02)` + 0.5px border

### 数据卡片（深色渐变背景）
用于突出核心数据（净资产、模拟仓总额等）：
```css
background: linear-gradient(145deg, darker 0%, darkest 100%);
/* 深色模式加边框 */
border: 0.5px solid rgba(主题色, 0.08-0.1);
```

### 按钮
- CTA：`border-radius: 14-16px; padding: 16-17px; font-weight: 600;`
- 浅色：实色背景 + 深阴影
- 深色：渐变背景 + 更深阴影

### FAB 浮动按钮
```css
width: 48-52px; height: 48-52px; border-radius: 14-16px;
position: absolute; bottom: 28px; right: 24px;
```

### 筛选 Chip
```css
padding: 6-7px 14-16px; border-radius: 8-10px; font-size: 12px; font-weight: 500;
```

---

## 排版规则

- 字体：`Inter` + 系统回退
- 大标题：28-32px / 800 weight / 负 letter-spacing
- 巨型数字：36-64px / 900 weight / -1.5 to -3px letter-spacing
- 正文：13-15px / 400-500 weight
- 标签：10-11px / 500-600 weight / 偶尔加 letter-spacing

---

## 设计禁忌

1. **不要平铺套模板** — 每个页面必须根据功能侧重点单独设计布局
2. **不要左右滑动导航** — PWA 会和系统手势冲突，用底部 Tab Bar
3. **不要纯黑背景** — 用 `#111110` 暖黑
4. **不要紫色渐变** — 避免 AI slop
5. **不要空洞的 empty state** — 即使没数据也要展示结构和视觉引导
6. **不要等权重平铺所有信息** — 必须有视觉层级主次

---

## 文件结构

```
prd/
├── home.html              # 首页（全局工具一览）
├── etf-analysis.html      # ETF 分析
├── etf-portfolio.html     # ETF 持仓
├── etf-orders.html        # ETF 条件单
├── etf-stats.html         # ETF 统计
├── accounting-home.html   # 记账首页
├── accounting-stats.html  # 记账统计
├── accounting-tools.html  # 记账工具
├── travel.html            # 旅行清单
├── correlation.html       # 相关性发现器
├── subscription.html      # 订阅管理
├── storage.html           # 储物定位
├── food-inventory.html    # 食材库存
├── habit-tracker.html     # 习惯打卡
├── body.html              # 身体档案
└── year-report.html       # 年报
```
