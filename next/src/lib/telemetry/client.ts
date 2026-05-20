export type TelemetryEvent = {
  name: string
  feature?: string
  path?: string
  trace_id?: string
  properties?: Record<string, unknown>
}

const queue: TelemetryEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const ANON_KEY = 'mdl_anon_id'

function getAnonId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(ANON_KEY)
  if (!id) {
    id = `a_${Math.random().toString(36).slice(2, 12)}`
    localStorage.setItem(ANON_KEY, id)
  }
  return id
}

export function track(ev: TelemetryEvent): void {
  if (typeof window === 'undefined') return
  queue.push(ev)
  if (!flushTimer) {
    flushTimer = setTimeout(() => void flush(), 2000)
  }
}

export async function flush(): Promise<void> {
  if (typeof window === 'undefined' || queue.length === 0) return
  const batch = queue.splice(0, 50)
  flushTimer = null
  const path = window.location.pathname
  try {
    await fetch(`${window.location.origin}/api/telemetry/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        events: batch.map((e) => ({
          name: e.name,
          feature: e.feature,
          path: e.path ?? path,
          anon_id: getAnonId(),
          properties: { ...e.properties, trace_id: e.trace_id },
        })),
      }),
    })
  } catch {
    /* non bloquant */
  }
  if (queue.length > 0) {
    flushTimer = setTimeout(() => void flush(), 1000)
  }
}
