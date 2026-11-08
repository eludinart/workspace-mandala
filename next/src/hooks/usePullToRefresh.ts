'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PULL_REFRESH_THRESHOLD_PX,
  isPullToRefreshUiEnabled,
} from '@/lib/pull-refresh'

export function usePullToRefresh(onRefresh: () => Promise<void>, disabled?: boolean) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const startY = useRef(0)
  const startX = useRef(0)
  const pulling = useRef(false)

  const run = useCallback(async () => {
    setRefreshing(true)
    setErrorMessage(null)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setPullDistance(0)
    }
  }, [onRefresh])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || disabled || !isPullToRefreshUiEnabled()) return

    const onStart = (e: TouchEvent) => {
      if (refreshing) return
      if (el.scrollTop > 0) {
        pulling.current = false
        return
      }
      const t = e.touches[0]
      startY.current = t.clientY
      startX.current = t.clientX
      pulling.current = true
    }

    const onMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return
      const t = e.touches[0]
      const dy = t.clientY - startY.current
      const dx = t.clientX - startX.current
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        pulling.current = false
        setPullDistance(0)
        return
      }
      if (el.scrollTop > 0 || dy <= 0) {
        setPullDistance(0)
        return
      }
      // Empêche le scroll natif pendant le rubber-band
      if (dy > 8) e.preventDefault()
      setPullDistance(Math.min(dy * 0.45, 120))
    }

    const onEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      setPullDistance((d) => {
        if (d >= PULL_REFRESH_THRESHOLD_PX && !refreshing) {
          void run()
          return d
        }
        return 0
      })
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [disabled, refreshing, run])

  const showError = useCallback((msg: string) => {
    setErrorMessage(msg)
    window.setTimeout(() => setErrorMessage(null), 2800)
  }, [])

  return { scrollRef, pullDistance, refreshing, errorMessage, showError }
}
