const IGNORED_ENTRY_NAMES = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  '__pycache__',
  '.tmp',
  'thumbs.db',
  '.idea',
  '.vscode',
  '.cache',
  '.next',
  '.nuxt',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'out'
])

const IGNORED_ENTRY_PATTERNS = [
  /\.log(?:\..+)?$/i,
  /\.tsbuildinfo$/i,
  /^electron\.vite\.config\.\d+\.mjs$/i
]

export function shouldIgnoreEntryName(name: string): boolean {
  if (IGNORED_ENTRY_NAMES.has(name)) {
    return true
  }

  return IGNORED_ENTRY_PATTERNS.some((pattern) => pattern.test(name))
}

export function shouldIgnorePath(targetPath: string): boolean {
  const normalizedPath = targetPath.replace(/\\/g, '/')
  const segments = normalizedPath.split('/').filter(Boolean)

  if (segments.some((segment) => IGNORED_ENTRY_NAMES.has(segment))) {
    return true
  }

  const name = segments[segments.length - 1]
  return name ? shouldIgnoreEntryName(name) : false
}
