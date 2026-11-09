'use client'

import { useEffect, useRef } from 'react'
import {
  readDocumentVisibility,
  resolvePollIntervalMs,
  type PollKind,
} from '@/lib/adaptive-poll'

/**
 * Appelle `tick` immédiatement, puis à intervalle tant que l’onglet est visible.
 * Pause totale si l’onglet est caché ; tick immédiat au retour.
 * `restartKey` : relance (ex. changement de canal / lieu).
 */
export function useVisibilityPoll(
  kind: PollKind,
  tick: () => void,
  enabled: boolean,
  restartKey?: string | number | boolean | null,
): void {
  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (!enabled) return

    let timer: ReturnType<typeof setInterval> | null = null

    const clear = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const arm = () => {
      clear()
      const ms = resolvePollIntervalMs(kind, readDocumentVisibility())
      if (ms == null) return
      timer = setInterval(() => tickRef.current(), ms)
    }

    const onVisibility = () => {
      if (readDocumentVisibility() === 'visible') {
        tickRef.current()
        arm()
      } else {
        clear()
      }
    }

    tickRef.current()
    arm()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [kind, enabled, restartKey])
}
