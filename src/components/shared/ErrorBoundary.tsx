import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  readonly children: ReactNode
}

interface ErrorBoundaryState {
  readonly error: Error | null
  readonly errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    error: null,
    errorInfo: null
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('React error boundary caught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  override render(): ReactNode {
    const { error, errorInfo } = this.state

    if (!error) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-8">
        <div className="w-full max-w-xl rounded-lg border border-border bg-surface p-6 text-text-primary shadow-[0_18px_45px_rgba(10,10,10,0.12)]">
          <div className="text-lg font-semibold">Aether 遇到错误</div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            当前界面状态已经被保护起来。重新加载后，Aether 会尝试恢复到可用状态。
          </p>

          <details className="mt-5 rounded-lg border border-border bg-canvas/70 px-4 py-3">
            <summary className="cursor-pointer select-none text-sm font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary">
              错误详情
            </summary>
            <pre className="aether-scrollbar mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-code-bg p-3 font-mono text-[12px] leading-5 text-code-text">
              {formatErrorDetails(error, errorInfo)}
            </pre>
          </details>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-9 items-center rounded-full border border-border bg-canvas px-4 text-sm font-medium text-text-primary transition-colors duration-150 hover:border-accent/40 hover:bg-hover focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:outline-none"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }
}

function formatErrorDetails(error: Error, errorInfo: ErrorInfo | null): string {
  const details = [
    `${error.name}: ${error.message}`,
    error.stack,
    errorInfo?.componentStack ? `Component stack:${errorInfo.componentStack}` : null
  ].filter(Boolean)

  return details.join('\n\n')
}
