'use client'

import { useEffect, useRef } from 'react'
import { track, flush } from '@/lib/telemetry/client'

/** Envoie page_view + session_start vers /api/telemetry/event */
export function TelemetryTracker({ page }: { page: string }) {
  const started = useRef(false)

  useEffect(() => {
    if (!started.current) {
      started.current = true
      track({ name: 'session_start', feature: 'app' })
    }
    track({ name: 'page_view', feature: 'navigation', properties: { page } })
    void flush()
  }, [page])

  useEffect(() => {
    const onHide = () => void flush()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  return null
}
