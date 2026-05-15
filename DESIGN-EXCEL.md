# Excel/CSV 表格中心 — 视觉与交互规格

> 基于 `.impeccable.md` 的 Nordic monochrome 体系扩展。所有 token 引用 .impeccable.md 中的 light/dark 对照。
> 本文档与 STAGE-11-SPEC.md 配套：STAGE-11-SPEC 管功能/数据/架构，DESIGN-EXCEL 管视觉/交互/动效。

## 设计哲学

> "把 Univer 的 Office 感剥掉，让数据本身成为唯一的视觉主体。"

三条铁律：
- **网格线退到背景** — 表格不是网线的展示场
- **色彩仅用于状态** — 选中、激活、警告，其余全部由 weight/space 表达
- **手部不抢戏** — 工具栏、tab、抽屉都是辅助器官

---

## 1. SheetViewer 容器（Univer 驯化）

### 1.1 外壳
沿用 FileViewer 的 `aether-glass rounded-[24px]` 外壳，**不嵌套二次圆角/边框**。Univer 容器直接铺到外壳的内边缘，靠 `overflow-hidden` 切角。

### 1.2 Univer chrome 关闭/驯化清单

| Univer 默认 | 处理 | CSS 选择器 |
|---|---|---|
| 顶部公式栏 | 隐藏 | `.univer-formula-bar`, `[data-id="formula-bar"]` → `display: none` |
| 顶部工具栏（ribbon） | 隐藏（功能交给选区浮动栏，§6） | `.univer-toolbar`, `.univer-ribbon` → `display: none` |
| 行列号侧栏 | 保留但削色 | `.univer-sheet-header` → `bg: canvas; color: text-muted; font-size: 11px; font-weight: 400; border-color: border-subtle` |
| 网格线 | 削弱 | `.univer-cell-border` → light `#ECECEA` / dark `#1F1F1F`，保持 1px |
| 默认字体 | 覆盖 | 单元格 `font-family: 'Noto Sans SC Variable', 'Space Grotesk Variable', system-ui; font-size: 13px` |
| 选中范围高亮 | 降饱和 | 边框 `accent` (#4A6B5C)，填充 `accent-subtle` 透明度 50% |
| 默认 tab bar | 隐藏（自实现，§2） | `.univer-sheet-bar` → `display: none` |

### 1.3 行列尺寸默认值
- 行高：22 → **28px**（呼吸感）
- 列宽：80 → **96px**
- 字号：14 → **13px**

---

## 2. Sheet Tab 栏（自实现）

### 2.1 容器
- 位置：SheetViewer 底部，贴外壳内边缘，左右 `px-4`
- 高度：**32px**
- 背景：透明（继承 aether-glass），上方 1px `border-subtle`
- 布局：`flex items-center gap-1`，溢出横向滚动用 `aether-scrollbar`（高度缩 4px）

### 2.2 单个 Tab

结构（极简到只有文字 + 一个状态点）：
```
[●  Sheet1]
```

| 状态 | 样式 |
|---|---|
| 非激活 | `text-text-muted text-[12px] font-normal px-2.5 h-6 rounded-md`，无背景边框 |
| Hover | `text-text-secondary bg-hover`（只换背景和字色） |
| 激活 | `text-text-primary text-[12px] font-medium px-2.5 h-6 rounded-md bg-highlight`，前置 4px 圆点 `bg-accent` |
| 编辑中 | inline `<input>`，无边框，cursor 闪烁 |

**禁止**：tab 之间不画分隔线；激活 tab 不"凸起"；不用渐变。

### 2.3 操作区（右侧）
- "+" 按钮：lucide `Plus` 14px，24×24 容器，`text-text-muted hover:text-text-primary hover:bg-hover`
- 不放其他按钮（删除/复制走右键）

### 2.4 交互行为

| 操作 | 行为 |
|---|---|
| 单击 tab | 切换激活，crossfade 100ms ease |
| 双击 tab 名 | inline 编辑，`Enter` 确认 / `Esc` 取消 |
| 右键 tab | 菜单：重命名 / 复制 / 删除（仅剩 1 个 sheet 时禁用删除） |
| 拖拽 tab | 重排顺序（拖动时 0.5 透明 + cursor-grabbing） |
| `Cmd+→/Cmd+←` | 切换上一/下一 sheet |

**右键菜单样式**：`surface-raised + border + shadow-md + rounded-md`，单项 28px / `px-3` / 字号 13px / `text-text-secondary hover:text-text-primary hover:bg-hover`，删除项 `text-error`。

---

## 3. EditorToolbar 增强

### 3.1 历史版本按钮
- 图标：lucide `History` 16px（**禁止 emoji**）
- 容器：32×32，圆角 6px，`text-text-muted hover:text-text-primary hover:bg-hover`，无边框
- `aria-label="历史版本"`
- 备份徽章：右上角 -2px 偏移，圆点直径 6px，`bg-accent`，无数字（数字进抽屉看）
- 激活态（抽屉打开）：`text-text-primary bg-highlight`

### 3.2 顺手清理
- 复制路径图标改 `Link2`
- 全宽切换三档：`AlignLeft / AlignCenter / Maximize2`
- 模式切换：`Eye` / `Pencil`，激活态 `bg-highlight + text-text-primary`，非激活 `text-text-muted`

---

## 4. 历史版本抽屉

### 4.1 外壳
- 宽度 **340px**
- 高度：贴满 SheetViewer 中间预览区
- 位置：`absolute right-0 top-0 bottom-0`，**不挤压 Univer 宽度**
- 背景：`bg-surface`
- 左侧：1px `border` 分隔线（**不用 shadow**）
- 圆角：仅右上右下 24px（跟随外壳）
- 入场：`translateX(340→0) + opacity(0→1)`，**240ms cubic-bezier(0.32, 0.72, 0, 1)**
- 出场：`translateX(0→340) + opacity(1→0)`，180ms ease-in
- **无遮罩**

### 4.2 头部
- 高度 48px，`px-4 flex items-center justify-between`
- 标题：`text-[13px] font-semibold text-text-primary`
- 关闭按钮：lucide `X` 16px，32×32 容器
- 底部 1px `border-subtle`

### 4.3 列表项

```
2026-04-29 14:50           23 KB
                                  预览  恢复
─────────────────────────────────
```

- `px-4 py-3`，无背景，hover `bg-hover`
- 各项之间 1px `border-subtle`（仅顶部，第一条无线）
- 时间：`text-[13px] font-medium text-text-primary` 单行 `YYYY-MM-DD HH:mm`（tooltip 显示秒）
- 大小：`text-[11px] text-text-muted`，与时间同行右对齐
- 操作行：时间下方 `mt-1.5`，**默认不显示**
- **整行 hover** 时操作行淡入：`opacity 0→1` 100ms
- 操作按钮：`text-[12px] text-text-secondary hover:text-text-primary`，`gap-3`，行高 24px
- "恢复"特殊：`text-accent hover:text-accent-hover font-medium`

### 4.4 状态区分
| 状态 | 视觉 |
|---|---|
| 当前文件版本（顶部固定） | 时间前加 lucide `Dot` 8px `text-accent`，文字 `font-semibold`，副标 "当前" `text-[10px] text-text-muted` |
| 历史版本 | 见 §4.3 |
| 分组 sticky header | "今天" / "2026-04-28"，`text-[10px] uppercase tracking-wider text-text-muted px-4 py-2 bg-surface` |
| 空状态 | 居中 `text-[12px] text-text-muted` "暂无历史版本，保存后会自动备份" |

### 4.5 恢复确认（inline，不用 modal）
- 点"恢复" → 该按钮变成 `[确认恢复] [取消]`，150ms 切换
- "确认恢复" `text-accent`；"取消" `text-text-muted`
- 5 秒后自动回默认状态
- 恢复成功：最顶部插入新"当前版本"条目，240ms slide-down，抽屉自动滚顶

### 4.6 键盘交互
- `Esc` 关闭抽屉
- `↑/↓` 在列表里移动焦点
- `Enter` = 触发预览
- `Cmd+Enter` = 触发恢复（带二次确认）

---

## 5. 只读警告条

### 5.1 重设计原则
警告本质是"信息陈述"，不是"危险信号"。用图标承担"注意"语义，背景仅作微弱区隔。

### 5.2 视觉规格
| 维度 | 值 |
|---|---|
| 高度 | 36px |
| 背景 light | `#FAF6EC`（warning-subtle） |
| 背景 dark | `#1E1A0E` |
| 字色 | `text-text-secondary`（不用 warning 色） |
| 边框 | 仅底部 1px `border-subtle` |
| 圆角 | 0 |
| padding | `px-4` |
| 字号 | `text-[12px] font-normal` |

### 5.3 内容布局
```
[Lock]  只读模式 · 12,345 行超过 10,000 行阈值              修改阈值
```
- 左侧 lucide `Lock` 14px `text-warning`（**唯一**用 warning 色的元素）
- 中点「·」分隔
- `12,345` 用 `font-medium text-text-primary`，其他保持 secondary
- "修改阈值" `text-[12px] text-text-secondary hover:text-text-primary underline-offset-2 hover:underline`

### 5.4 入场/退场
- 出现：`max-height 0→36px + opacity 0→1`，200ms ease-out
- 隐藏：`max-height 36px→0 + opacity 1→0`，150ms ease-in
- 无 dismiss 按钮

---

## 6. 选区浮动样式栏（Numbers 式）

> 取代 Univer 默认顶部 ribbon。选中单元格后，**浮动小条**从选区上方淡入，承载所有样式操作。

### 6.1 触发与位置
- 选区 ≥ 1 个单元格时显示
- 浮在选区上方 8px，水平居中对选区
- 切换选区或失焦后 100ms 淡出

### 6.2 容器
- 高度 36px
- 背景：light `surface-raised + 1px border + shadow-md` (`0 4px 12px rgba(0,0,0,0.08)`)；dark 同结构换 token
- 圆角 8px
- padding `px-2 py-1.5`
- 入场：`opacity 0→1 + translateY(4px→0)`，150ms ease-out

### 6.3 按钮组（左到右，1px 竖线 `border-subtle` 分隔）
```
[B] [I] [U] | [A▾] [◨▾] | [⛚] | [☰▾] [☲▾]
```
- 每个按钮 28×28，无背景，hover `bg-hover`，激活态 `text-accent + bg-accent-subtle`
- 图标 lucide 16px：`Bold`, `Italic`, `Underline`, `Type`（字色，下方色块）, `PaintBucket`, `Combine`（合并）, `AlignLeft`, `AlignVerticalSpaceAround`
- 颜色选择器下拉：`surface-raised + shadow-md + rounded-md + p-3`，色板每行 8 个 18×18 圆点

---

## 7. 新增 token

需要在 Tailwind config 同步：

| 名称 | Light | Dark | 用途 |
|---|---|---|---|
| `warning-subtle` | `#FAF6EC` | `#1E1A0E` | 警告条背景 |
| `accent-subtle` 透明版 | `rgba(74,107,92,0.08)` | `rgba(107,138,122,0.10)` | 选区高亮填充 |
| `cell-border` | `#ECECEA` | `#1F1F1F` | Univer 网格线 |
| `cell-header-bg` | `#FAFAFA` | `#0E0E0E` | 行列号背景 |

---

## 8. 全局动效一致性

| 元素 | duration | easing | 类型 |
|---|---|---|---|
| 选区浮动栏出现 | 150ms | ease-out | opacity + translateY(4px) |
| Tab 切换 | 100ms | ease | opacity crossfade |
| 抽屉滑入 | 240ms | cubic-bezier(0.32, 0.72, 0, 1) | translateX + opacity |
| 抽屉滑出 | 180ms | ease-in | translateX + opacity |
| 列表项 hover 操作浮现 | 100ms | ease | opacity |
| 警告条出现 | 200ms | ease-out | max-height + opacity |
| 恢复按钮二次确认切换 | 150ms | ease | width + opacity |
| 恢复成功后新条目插入 | 240ms | cubic-bezier(0.32, 0.72, 0, 1) | slide-down |

**全部尊重 `prefers-reduced-motion: reduce`** → 改为 150ms opacity-only。
