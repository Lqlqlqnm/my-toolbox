# My Toolbox UI 改造 - 操作文档

## 背景

在 Mac 端对 my-toolbox 进行了 UI 改造（C 风格深浅色主题），但过程中覆盖了部分前端功能代码（首页 8 个模块卡片被减为 3 个等）。已回滚远程 git 到 `20552a0`（2026-06-12 14:54 的版本）。

**当前状态：**
- 远程 git / 线上部署：已回滚到 18:00 前的版本，功能完整
- Windows 本地：有最完整的前端代码（包含所有模块）
- Mac 本地：代码是回滚后的状态

## 需要做的事

从 Windows 电脑推送最新前端代码到 git，然后在此基础上重新应用 UI 改造。

---

## 步骤 1：Windows 电脑推送代码

```bash
cd my-toolbox

# 确认当前分支
git branch

# 拉取远程最新（回滚后的 20552a0）
git pull origin main --rebase

# 如果有冲突，解决后 git add 冲突文件，然后 git rebase --continue

# 查看你的改动
git status
git diff --stat

# 添加你改过的文件（不要 git add -A）
# 主要是以下文件（根据实际 git status 调整）：
git add src/pages/Home.tsx
git add src/App.tsx
# ... 其他你改过的文件

# 提交
git commit -m "restore: 补回完整前端模块（8模块首页等）"

# 推送
git push origin main
```

---

## 步骤 2：重新应用 UI 改造

以下改造需要在 Windows 推送完成后进行。核心原则：**不删除任何现有功能，只改样式**。

### 2.1 已完成的改造（需要重新应用）

| 改造项 | 说明 |
|--------|------|
| Tailwind darkMode: 'class' | tailwind.config.js |
| theme.ts 主题工具 | src/lib/theme.ts（system/dark/light 三态） |
| App.tsx 根背景色 | `bg-[#f4f4f5] dark:bg-[#0c0c0d]` |
| 设置页主题切换 | Settings.tsx 加外观切换按钮 |
| 首页 C 风格卡片 | Home.tsx - 深色渐变卡 / 浅色白卡+竖条 |
| SVG 图标替换 | public/icons-* + CategoryIcon.tsx 改为 img |
| 各模块暗色 token | `dark:bg-[#141416]` / `dark:border-white/[0.06]` |
| 概览卡深色渐变 | `linear-gradient(135deg, #1f2937, #111827)` |
| 列表项独立卡片 | rounded-xl + shadow-sm + 左侧彩色色条 |
| 预算可展开卡片 | Overview 中预算独立展示 |
| Modal showForm | 多字段单弹窗替代连续 prompt |
| 资产卡计算逻辑 | 总资产=正余额+借出, 总负债=信用卡+借入 |
| 旅行清单排序 | 编辑模式上下箭头移动物品 |
| 备份横幅适配暗色 | App.tsx 横幅改为深色底 |
| Analysis 按钮不重叠 | URL 输入删除按钮改为行内 |

### 2.2 设计规则速查

```
页面背景:    浅色 #f4f4f5    深色 #0c0c0d
卡片背景:    浅色 white      深色 #141416
卡片边框:    浅色 border-gray-100   深色 border-white/[0.06]
卡片圆角:    rounded-xl + shadow-sm
左侧色条:    absolute left-0 top-0 bottom-0 w-0.5 bg-{color}-400 dark:hidden
概览/摘要卡: linear-gradient(135deg, #1f2937, #111827) 白字
段标题:      text-[11px] text-gray-400 dark:text-gray-600 mb-2
主文字:      text-gray-900 dark:text-white
副文字:      text-gray-400 dark:text-gray-600
icon 背景:   bg-{color}-500/10 (如 bg-red-500/10)
```

### 2.3 首页改造注意事项

**重要：不要删除任何模块卡片！** 原始首页有 8 个模块：
1. ETF 策略助手
2. 记账本
3. 旅行清单
4. 相关性发现器
5. 订阅管理
6. 储物定位器
7. 食材库存（如有）
8. 习惯打卡（如有）

改造时只改样式（加渐变/色条/icon），保留所有 href 和数据逻辑。

### 2.4 快捷工具处理

记账本 Overview 页面中的快捷工具网格（预算/周期/借还等）：
- **删除网格**，改为预算独立展开卡片
- 其他入口通过顶部 Tab（工具页）访问

---

## 步骤 3：文件清单

以下是 UI 改造涉及的文件（供参考，实际操作时逐个改）：

```
tailwind.config.js          - darkMode: 'class'
src/lib/theme.ts            - 新建（主题切换逻辑）
src/App.tsx                 - 根背景 + 主题初始化 + 横幅
src/pages/Home.tsx          - C 风格卡片（保留所有模块！）
src/pages/Settings.tsx      - 外观切换
src/components/CategoryIcon.tsx - SVG img 渲染
src/components/Modal.tsx    - showForm 多字段
public/icons-expense/       - SVG 图标文件
public/icons-income/        - SVG 图标文件
public/icons-bank/          - SVG 图标文件
public/icons-finance/       - SVG 图标文件
src/pages/accounting/       - 所有子页面配色
src/pages/trading/          - 所有子页面配色
src/pages/travel/           - 所有子页面配色 + 排序
```

---

## 关键注意事项

1. **绝不删除功能代码** — 只改 className 和 JSX 结构
2. **不用动态 Tailwind class** — 用 map 对象（如 `{ expense: 'bg-red-500/10' }`）
3. **CategoryIcon 兼容旧数据** — emoji 仍然能渲染（isEmoji 检查）
4. **每改一个文件自查** — 确认没有引入 import 错误或丢失功能
5. **分步提交** — 每完成一个模块 commit 一次，方便回滚
