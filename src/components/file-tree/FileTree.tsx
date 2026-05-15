import type { FileNode } from '../../types'
import { TreeNode } from './TreeNode'

const EMPTY_SET: ReadonlySet<string> = new Set()

interface FileTreeProps {
  readonly tree: FileNode | null
  readonly loading: boolean
  readonly error: string | null
  readonly selectedPath: string | null
  readonly expandedPaths?: ReadonlySet<string>
  readonly onSelect: (node: FileNode) => void
  readonly onCopyPath: (path: string) => void
  readonly onBuildContext?: (folderPath: string) => void
  readonly onToggleExpand?: (node: FileNode, expanded: boolean) => void
}

export function FileTree({
  tree,
  loading,
  error,
  selectedPath,
  expandedPaths,
  onSelect,
  onCopyPath,
  onBuildContext,
  onToggleExpand
}: FileTreeProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-text-muted">扫描文件中...</div>
    )
  }

  if (error) {
    return <div className="grid h-full place-items-center text-sm text-error">{error}</div>
  }

  if (!tree) {
    return (
      <div className="grid h-full place-items-center text-sm text-text-muted">
        点击上方按钮选择工作区文件夹
      </div>
    )
  }

  return (
    <div className="aether-scrollbar h-full overflow-y-auto pr-1" role="tree" aria-label="文件树">
      <div className="px-5 py-2 text-xs font-medium text-text-secondary">{tree.name}</div>
      <div className="px-3">
        {(tree.children ?? []).map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths ?? EMPTY_SET}
            onSelect={onSelect}
            onCopyPath={onCopyPath}
            onBuildContext={onBuildContext}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>
    </div>
  )
}
