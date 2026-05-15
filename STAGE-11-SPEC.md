# 阶段 11：Excel/CSV 表格中心 — 设计规格

> 本文档是阶段 11 的单一信源（single source of truth）。任何 Codex 指令引用的规格都从这里抽取并内联到指令中。

## 1. 目标

在中间预览区（FileViewer）支持打开 `.csv` 和 `.xlsx` 文件，提供 Apple Numbers 级的轻量 + 完整体验：
- 浏览/编辑单元格内容
- 合并单元格
- 样式调整（字体、字号、加粗/斜体/下划线、文字颜色、背景色、边框）
- 多 sheet（xlsx）tab 切换
- **不支持公式**

## 2. 技术选型

| 模块 | 选型 | 版本约束 |
|---|---|---|
| 表格 UI | `@univerjs/presets`（Univer 开源版） | ≥ 0.5（按 npm latest）|
| xlsx 读写 | `exceljs` | ≥ 4.4 |
| csv 读写 | `papaparse` | ≥ 5.4 |

**Univer 配置裁剪**：禁用 `UniverSheetsFormulaPreset` / `UniverSheetsConditionalFormattingPreset` / `UniverSheetsDataValidationPreset`，仅保留 sheets core + numfmt + sort-filter + UI。

## 3. 数据模型

### 3.1 中间格式（统一 csv/xlsx）

```ts
// src/types/sheet.ts
export interface SheetCellStyle {
  readonly fontFamily?: string
  readonly fontSize?: number
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly color?: string       // hex e.g. "#1F2937"
  readonly background?: string  // hex
  readonly border?: {
    readonly top?: string       // hex 颜色，存在即表示有边框
    readonly right?: string
    readonly bottom?: string
    readonly left?: string
  }
  readonly horizontalAlign?: 'left' | 'center' | 'right'
  readonly verticalAlign?: 'top' | 'middle' | 'bottom'
}

export interface SheetCell {
  readonly value: string | number | boolean | null
  readonly style?: SheetCellStyle
}

export interface MergedRange {
  readonly startRow: number     // 0-based
  readonly endRow: number       // inclusive
  readonly startCol: number
  readonly endCol: number
}

export interface SheetTab {
  readonly id: string                      // sheet id（xlsx 原始 id 或自动生成）
  readonly name: string                    // sheet 名（用户可见）
  readonly rowCount: number
  readonly colCount: number
  readonly cells: ReadonlyArray<ReadonlyArray<SheetCell | null>>  // [row][col]
  readonly mergedRanges: readonly MergedRange[]
  readonly columnWidths?: readonly number[]   // 每列宽度（px）
  readonly rowHeights?: readonly number[]
}

export interface SheetDocument {
  readonly format: 'xlsx' | 'csv'
  readonly sheets: readonly SheetTab[]
  readonly activeSheetId: string
}
```

### 3.2 Config 扩展

`CockpitConfig` 增加 `excel` 字段：

```ts
export interface ExcelConfig {
  readonly backupDir: string         // 默认 "/Users/tiamo/excel-backups"
  readonly maxBackupsPerFile: number // 默认 10
  readonly dailyKeepDays: number     // 默认 7
  readonly readOnlyRowThreshold: number // 默认 10000
}
```

默认值定义在 `electron/services/config-store.ts` 的 `DEFAULT_CONFIG`。

## 4. 备份与安全

### 4.1 备份目录结构

```
{backupDir}/
  └─ {fileHash}/                          # 用文件 ID（content hash）做隔离
      ├─ meta.json                        # { originalPath, originalName }
      ├─ 20260429-143022.xlsx
      ├─ 20260429-145511.xlsx
      └─ ...
```

用 `fileHash` 做目录名，避免不同位置的同名文件互相覆盖。

### 4.2 保存流程（必须严格执行）

```
1. 计算 fileHash（沿用 src/types 中的 file ID 规则）
2. 在 {backupDir}/{fileHash}/ 写入 {timestamp}.{ext}（直接拷贝当前磁盘上的原文件）
3. 写新内容到 {originalPath}.tmp
4. 用 ExcelJS 重新读取 .tmp 文件，校验：
   - 能成功解析
   - sheet 数量 == 内存中的 sheet 数量
   - 每个 sheet 的 cell 计数 == 内存
5. 校验通过 → fs.rename(.tmp, originalPath)
6. 校验失败 → 删除 .tmp，抛错"保存失败，原文件未改动"
7. 触发备份清理：保留最近 N 份 + 每天最后一份（最多 daysKeep 天）
```

### 4.3 备份清理策略

```
对 {backupDir}/{fileHash}/ 下的备份文件：
1. 先按时间倒序排列
2. 保留最近 maxBackupsPerFile 份（默认 10）
3. 在剩余备份中，按"日期"分组，每天保留最新的一份
4. 仅保留最近 dailyKeepDays 天（默认 7）的"每天一份"
5. 其余删除
```

### 4.4 历史版本恢复流程

```
1. 用户点击某条历史 → 弹确认框
2. 确认后：
   a. 先按"4.2 保存流程"备份当前磁盘版本
   b. 把选中备份拷贝覆盖到 {originalPath}
   c. 触发 SheetViewer 重新读取
```

## 5. UI 规格

### 5.1 SheetViewer 容器

复用 `FileViewer` 的外壳（`aether-glass`, `rounded-[24px]`），中间预览区从 MarkdownViewer/Editor 改为 Univer 容器。

**布局**：
```
┌─ EditorToolbar（复用，但隐藏字数/搜索按钮，新增"历史版本"按钮）
├─ 只读警告条（仅当超阈值时显示，黄底 #FEF3C7，文字 #92400E）
├─ Univer 容器（min-h-0 flex-1）
└─ Sheet Tab 栏（底部，仅 xlsx 多 sheet 显示）
```

### 5.2 Sheet Tab 栏

- 高度 36px，底部对齐
- 背景：`bg-surface-elevated`，上边框 `border-t border-border-subtle`
- 单个 tab：内边距 `px-4 py-1.5`，圆角 `rounded-t-md`
- 激活 tab：背景 `bg-surface`，文字 `text-text-primary`，下边框对齐
- 非激活 tab：文字 `text-text-secondary`，hover 时 `bg-surface-hover`

### 5.3 历史版本抽屉

- 触发：EditorToolbar 右上角加按钮"🕐 历史版本"
- 面板：从右侧滑入，宽 360px，高度撑满中间预览区
- 标题栏：文件名 + 关闭按钮
- 列表项布局：
  ```
  ┌─────────────────────────────────┐
  │ 2026-04-29 14:50:11             │
  │ 23.4 KB                          │
  │ [预览]  [恢复]                   │
  └─────────────────────────────────┘
  ```
- 间距：每项 `py-3 px-4`，分隔线 `border-b border-border-subtle`
- 时间倒序

### 5.4 只读警告条

```
高度 32px，背景 #FEF3C7，文字 #92400E
内容："⚠ 只读模式：文件超过 10000 行（当前 12345 行），编辑功能已禁用"
"修改阈值"按钮 → 跳到设置页 Excel 配置项
```

### 5.5 未保存提示

切换文件/关闭窗口/关闭 tab 时，若 `hasUnsavedChanges` 为 true：
- 弹原生 `dialog.showMessageBox`：
  - title: "未保存的更改"
  - message: "{filename} 有未保存的更改，是否保存？"
  - buttons: ["保存", "不保存", "取消"]
  - defaultId: 0, cancelId: 2

## 6. 文件 ID 规则（沿用阶段 1）

`md5(文件前 1KB 内容 + 文件大小)`。`src/types/file.ts` 已定义 `FileNode.id`。Excel 模块复用同一套 ID 计算函数（位置：`electron/utils/` 里若没有则新建 `file-id.ts`）。

## 7. IPC API

`window.electronAPI.excel`:

```ts
interface ExcelApi {
  readonly read: (path: string) => Promise<{ success: boolean; data?: SheetDocument; error?: string }>
  readonly save: (path: string, doc: SheetDocument) => Promise<{ success: boolean; error?: string }>
  readonly listBackups: (fileHash: string) => Promise<{ success: boolean; data?: BackupEntry[]; error?: string }>
  readonly restoreBackup: (fileHash: string, backupName: string, targetPath: string) => Promise<{ success: boolean; error?: string }>
  readonly previewBackup: (fileHash: string, backupName: string) => Promise<{ success: boolean; data?: SheetDocument; error?: string }>
}

interface BackupEntry {
  readonly name: string         // 文件名 e.g. "20260429-143022.xlsx"
  readonly timestamp: string    // ISO 8601
  readonly size: number         // bytes
}
```

所有方法返回统一格式 `{ success, data?, error? }`（与项目现有 IPC 风格一致）。

## 8. FileViewer 路由规则

```
扩展名 → 渲染组件
.md / .markdown / .txt → MarkdownViewer / MarkdownEditor（现状）
.csv / .xlsx → SheetViewer
.png / .jpg / .svg → ImageLightbox（现状）
其他 → "暂不支持预览此文件类型"
```

`FileViewer.tsx` 增加路由分支，新增 props `onSheetSave`, `sheetData`, `sheetLoading` 等。

## 9. 验收清单（最终）

- [ ] 打开 1KB csv → 显示数据，可编辑保存
- [ ] 打开多 sheet xlsx → tab 切换正常
- [ ] 合并 2x3 单元格 → 保存 → 重开仍合并
- [ ] 改文字颜色/背景/字号 → 保存 → 重开样式保留
- [ ] 打开 11000 行 xlsx → 显示只读警告 + 无法编辑
- [ ] 编辑后切文件 → 弹未保存提示
- [ ] 保存 5 次 → 备份目录有 5 个文件
- [ ] 恢复历史版本 → 当前版本被自动备份 → 文件回到历史状态
- [ ] 设置面板修改备份目录 → 旧备份可选迁移
- [ ] 模拟写入失败（断电/磁盘满）→ 原文件未改动
