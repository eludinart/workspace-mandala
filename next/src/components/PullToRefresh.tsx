'use client'

import { useCallback } from 'react'
import type { MandalaPage } from '@/components/MandalaApp'
import { runPullRefresh } from '@/lib/pull-refresh'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'

export function PullToRefresh({
  page,
  children,
  className = '',
  disabled = false,
}: {
  page: MandalaPage
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  const onRefresh = useCallback(async () => {
    const result = await runPullRefresh(page)
    if (result === 'hard') {
      window.location.reload()
      return
    }
    if (result === 'soft-error') {
      throw new Error('soft-error')
    }
  }, [page])

  const { scrollRef, pullDistance, refreshing, errorMessage, showError } = usePullToRefresh(
    async () => {
      try {
        await onRefresh()
      } catch {
        showError('Impossible de rafraîchir')
      }
    },
    disabled,
  )

  const indicatorVisible = pullDistance > 8 || refreshing

  return (
    <div ref={scrollRef} className={`relative min-h-0 ${className}`}>
      <div
        className="pointer-events-none sticky top-0 z-20 flex justify-center overflow-hidden"
        style={{ height: indicatorVisible ? Math.max(pullDistance, refreshing ? 40 : 0) : 0 }}
        aria-hidden={!indicatorVisible}
      >
        <div className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/90 border border-slate-700 shadow">
          <span
            className={`block h-4 w-4 rounded-full border-2 border-accent border-t-transparent ${
              refreshing || pullDistance >= 70 ? 'animate-spin' : ''
            }`}
          />
        </div>
      </div>
      {errorMessage && (
        <p className="sticky top-0 z-20 mx-auto mt-1 w-fit rounded-full bg-slate-900/95 px-3 py-1 text-xs text-rose-300 border border-rose-900/50">
          {errorMessage}
        </p>
      )}
      <div style={{ transform: pullDistance && !refreshing ? `translateY(${pullDistance}px)` : undefined }}>
        {children}
      </div>
    </div>
  )
}
