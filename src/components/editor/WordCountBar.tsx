import { useMemo } from 'react'

interface WordCountBarProps {
  readonly content: string
}

export function WordCountBar({ content }: WordCountBarProps): React.JSX.Element {
  const stats = useMemo(() => {
    const plainText = content
      .replace(/^---[\s\S]*?---\n?/, '')
      .replace(/!?\[.*?\]\(.*?\)/g, '')
      .replace(/[#*`>~\-|]/g, '')
      .trim()

    const chars = plainText.replace(/\s/g, '').length
    const chineseChars = (plainText.match(/[\u4e00-\u9fff]/g) ?? []).length
    const englishWords = plainText
      .replace(/[\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0).length

    return { chars, chineseChars, englishWords }
  }, [content])

  return (
    <div className="flex shrink-0 items-center gap-4 px-4 py-2 text-xs text-text-muted">
      <span>{stats.chars} 字符</span>
      <span>{stats.chineseChars} 中文</span>
      <span>{stats.englishWords} 英文词</span>
    </div>
  )
}
