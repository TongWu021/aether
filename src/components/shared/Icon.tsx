import fileGeneric from '../../assets/icons/file-generic.svg?raw'
import fileCode from '../../assets/icons/file-code.svg?raw'
import fileImage from '../../assets/icons/file-image.svg?raw'
import fileJson from '../../assets/icons/file-json.svg?raw'
import fileMarkdown from '../../assets/icons/file-markdown.svg?raw'
import brandAether from '../../assets/icons/brand-aether.svg?raw'
import folderClosed from '../../assets/icons/folder-closed.svg?raw'
import folderOpen from '../../assets/icons/folder-open.svg?raw'
import moduleBrain from '../../assets/icons/module-brain.svg?raw'
import modulePrd from '../../assets/icons/module-prd.svg?raw'

const ICONS = {
  'brand-aether': brandAether,
  'file-generic': fileGeneric,
  'file-code': fileCode,
  'file-image': fileImage,
  'file-json': fileJson,
  'file-markdown': fileMarkdown,
  'folder-closed': folderClosed,
  'folder-open': folderOpen,
  'module-brain': moduleBrain,
  'module-prd': modulePrd
} as const

interface IconProps {
  readonly name: string
  readonly size?: number
  readonly className?: string
}

export function Icon({ name, size = 16, className }: IconProps): React.JSX.Element | null {
  const svg = ICONS[name as keyof typeof ICONS]

  if (!svg) {
    return null
  }

  return (
    <span
      aria-hidden="true"
      className={['inline-flex items-center justify-center', className ?? ''].join(' ').trim()}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: resizeSvgMarkup(svg, size) }}
    />
  )
}

function resizeSvgMarkup(svg: string, size: number): string {
  return svg.replace(/width="[^"]*"/, `width="${size}"`).replace(/height="[^"]*"/, `height="${size}"`)
}
