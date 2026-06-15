'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

// Client-side error boundary for the Analysis view. The route-level error.tsx
// catches render errors too, but this gives a scoped, recoverable fallback that
// keeps the rest of the app shell intact if AnalysisClient throws during render.
export class AnalysisErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[AnalysisErrorBoundary] render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 rounded-[var(--radius-md)] border border-[var(--color-loss)] p-6 text-[var(--color-loss)]">
          <p className="font-semibold">Analysis error</p>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {this.state.error?.message ?? 'Something went wrong rendering this view.'}
          </p>
          <button
            className="mt-3 text-sm underline"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
