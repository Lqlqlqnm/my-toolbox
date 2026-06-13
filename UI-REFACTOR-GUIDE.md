# My Toolbox 改造操作指南

## 背景

项目在 Mac 端进行 UI 改造时覆盖了部分前端功能代码，已回滚远程 git 到 `20552a0`。Windows 本地有最完整的前端代码。本文档指导如何恢复代码并重新进行 UI 改造 + 功能优化。

---

## 一、Git 推送步骤（Windows 电脑执行）

```bash
cd my-toolbox

# 1. 拉取远程最新
git pull origin main --rebase

# 2. 如果有冲突：解决后 git add 冲突文件，git rebase --continue

# 3. 查看改动范围
git status
git diff --stat

# 4. 只添加你改过的文件（绝不要用 git add -A）
git add src/pages/Home.tsx
git add src/App.tsx
# ... 按 git status 列表逐个添加

# 5. 提交并推送
git commit -m "restore: 补回完整前端代码"
git push origin main
```

**注意：** 推送后 Cloudflare Pages 会自动部署。确认线上功能正常后再进行 UI 改造。

---

## 二、UI 改造指南

### 设计规范

**严格以 `prd/DESIGN-SPEC.md` 为准。** 以下是关键要点摘要：

#### 风格定位
iOS 26 风格 + 莫兰迪低饱和色系，功能决定布局。

#### 色彩
| 模式 | 背景 | 卡片 | 主文字 | 次文字 |
|------|------|------|--------|--------|
| 浅色 | `#f6f4f1` | `#fff` + `0.5px solid rgba(0,0,0,0.04)` | `#1a1816` | `#9a9590` |
| 深色 | `#111110` | `rgba(255,255,255,0.02)` + `0.5px solid rgba(255,255,255,0.05)` | `#f0ece8` | `#5a5550` |

各模块有独立主题色，见 DESIGN-SPEC.md 中"各模块主题色"表格。

#### 组件规则
- 卡片圆角：18-22px
- 内边距：18-24px
- 巨型数字：36-64px / 900 weight / 负 letter-spacing
- Tab Bar：底部浮动 + 毛玻璃 + 纯文字无图标
- FAB：48-52px 方形圆角按钮

#### 原型文件
每个页面都有对应的 HTML 原型：
```
prd/home.html              → 首页
prd/etf-analysis.html      → ETF 分析
prd/etf-portfolio.html     → ETF 持仓
prd/etf-orders.html        → ETF 条件单
prd/etf-stats.html         → ETF 统计
prd/accounting-home.html   → 记账首页
prd/accounting-stats.html  → 记账统计
prd/accounting-tools.html  → 记账工具
prd/travel.html            → 旅行清单
prd/correlation.html       → 相关性发现器
prd/subscription.html      → 订阅管理
prd/storage.html           → 储物定位
prd/food-inventory.html    → 食材库存
prd/habit-tracker.html     → 习惯打卡
prd/body.html              → 身体档案
prd/year-report.html       → 年报
```

### 改造流程

1. 读取对应的 `prd/xxx.html` 原型
2. 读取当前页面代码
3. **只改样式和布局，不改功能逻辑**
4. 逐个文件改造，每改完一个 commit 一次
5. 每个文件改完后自查（见避坑事项）

### 主题切换实现

需要新建 `src/lib/theme.ts`：
- 存储：localStorage key `theme-mode`，值 `system` | `dark` | `light`
- 逻辑：往 `<html>` 加/移除 `dark` class
- 监听：`prefers-color-scheme` 变化时自动切换（system 模式下）
- 设置页：三按钮切换（跟随系统/浅色/深色）

`tailwind.config.js` 改 `darkMode: 'class'`。

---

## 三、避坑注意事项

### 绝对红线
1. **绝不删除任何功能代码** — 只改 className 和 JSX 结构
2. **绝不减少首页模块数量** — 当前有 8+ 个模块，必须全部保留
3. **绝不用 `git add -A` 或 `git add .`** — 逐文件添加

### Tailwind 相关
4. **不用动态 class 拼接** — `bg-${color}-500` 不会被编译，必须用完整字符串映射：
```tsx
// 错误
className={`bg-${color}-500/10`}

// 正确
const bgMap = { expense: 'bg-red-500/10', income: 'bg-green-500/10' }
className={bgMap[type]}
```

### 组件相关
5. **CategoryIcon 必须兼容旧数据** — 数据库中可能存有 emoji 图标（旧用户），渲染组件必须 isEmoji 检查兜底
6. **SVG 图标文件** — 放 `public/icons-expense/`、`icons-income/`、`icons-bank/`、`icons-finance/`，通过 `<img src="/icons-xxx/name.svg">` 渲染

### 流程相关
7. **每改一个文件必须自查：**
   - import 是否正确
   - 有没有引用不存在的变量/函数
   - 功能逻辑是否完整保留
   - 动态数据是否正常渲染
8. **分步提交** — 每完成一个模块 commit 一次，便于回滚

---

## 四、功能需求清单

除 UI 改造外，以下功能需求需要实现：

### 4.1 记账 - 资产计算逻辑
当前 Overview 的"净资产"计算需要改为：
- **总资产** = 所有账户正余额 + 借出未还（别人欠你的）
- **总负债** = 信用卡欠款（余额为负的绝对值） + 借入未还（你欠别人的）
- **净资产** = 总资产 - 总负债

卡片布局：总资产放大居中偏上，总负债和净资产在下一行左右对称。

需要加载 debts 数据（`db.debts.filter(d => !d.is_settled).toArray()`）。

### 4.2 旅行清单 - 物品排序
编辑模式下每个物品支持上下移动排序：
- 上下箭头按钮（编辑模式可见）
- 第一个禁用上移，最后一个禁用下移
- 交换后实时保存到 DB（`saveCategories(updated)`）

### 4.3 弹窗合并
连续多步 prompt 弹窗合并为单个多字段表单弹窗：

| 位置 | 原来 | 改为 |
|------|------|------|
| 旅行 - 创建行程 | 弹窗1:名称 → 弹窗2:日期 | 单表单（名称+日期） |
| 旅行 - 添加分类 | 弹窗1:名称 → 弹窗2:图标 | 单表单（名称+图标） |

需要给 Modal 组件新增 `showForm(title, fields[])` 方法，支持多字段。

### 4.4 备份提醒横幅
App.tsx 顶部的备份提醒横幅需要适配深浅色模式，不能用刺眼的纯色背景（如 amber-500）。改为深色底 + 小按钮。

### 4.5 ETF 分析 - 按钮重叠
URL 输入行的"删除"和"提取"按钮在移动端重叠。删除按钮不要用 absolute 定位，改为行内 X 图标。

### 4.6 记账首页 - 快捷工具
Overview 页面的快捷工具网格（4x2 彩色块）视觉突兀，移除。预算独立为可展开卡片（点击展开各分类明细）。其他工具通过顶部 Tab "工具"页进入。

---

## 五、执行顺序建议

1. Windows 推送完整代码 → 确认线上功能正常
2. `tailwind.config.js` + `src/lib/theme.ts` + `App.tsx` 基础主题
3. 首页 `Home.tsx`（保留所有模块！）
4. 设置页主题切换
5. 功能需求（4.1-4.6）
6. 逐模块 UI 改造（按 prd/ 原型）
7. 每步完成后验证部署
