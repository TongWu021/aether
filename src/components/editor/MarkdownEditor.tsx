import { useEffect, useState } from 'react'

import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'

interface MarkdownEditorProps {
  readonly content: string
  readonly onChange: (value: string) => void
  readonly className?: string
}

export function MarkdownEditor({
  content,
  onChange,
  className
}: MarkdownEditorProps): React.JSX.Element {
  const colorMode = useColorScheme()

  return (
    <div className={['h-full overflow-hidden', className ?? ''].join(' ')} data-color-mode={colorMode}>
      <MDEditor
        value={content}
        onChange={(value) => {
          onChange(value ?? '')
        }}
        preview="edit"
        height="100%"
        visibleDragbar={false}
        textareaProps={{
          placeholder: '开始编写 Markdown...',
          spellCheck: false
        }}
      />
    </div>
  )
}

function useColorScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (event: MediaQueryListEvent): void => {
      setScheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const themeAttr = document.documentElement.getAttribute('data-theme')

      if (themeAttr === 'dark' || themeAttr === 'light') {
        setScheme(themeAttr)
      }
    })

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      observer.disconnect()
    }
  }, [])

  return scheme
}
