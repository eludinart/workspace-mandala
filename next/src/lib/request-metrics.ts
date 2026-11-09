/**
 * Compteurs charge API en mémoire process (reset au redeploy).
 * Fenêtre glissante ~60 s + buckets pour mini-historique ~15 min.
 */

const WINDOW_MS = 60_000
const BUCKET_MS = 30_000
const BUCKET_COUNT = 30 // 15 min
const MAX_PATHS = 40
const MAX_EVENTS = 2_000

export type RequestEvent = {
  at: number
  path: string
  status: number
  ms: number
}

export type PathStats = {
  path: string
  count: number
  errors: number
  avgMs: number
  p95Ms: number
}

export type LoadSnapshot = {
  windowSec: number
  rps: number
  avgMs: number
  p95Ms: number
  requests: number
  errors: number
  errorRate: number
  topSlow: PathStats[]
  topErrors: PathStats[]
  series: Array<{ at: number; rps: number; avgMs: number; errors: number }>
  poolEnqueueTotal: number
  poolEnqueueRecent: number
  startedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __mdl_request_metrics:
    | {
        events: RequestEvent[]
        buckets: Array<{ start: number; count: number; errorCount: number; totalMs: number }>
        poolEnqueueTotal: number
        poolEnqueueRecent: number[]
        startedAt: number
      }
    | undefined
}

function store() {
  if (!globalThis.__mdl_request_metrics) {
    globalThis.__mdl_request_metrics = {
      events: [],
      buckets: [],
      poolEnqueueTotal: 0,
      poolEnqueueRecent: [],
      startedAt: Date.now(),
    }
  }
  return globalThis.__mdl_request_metrics
}

/** Normalise le path API (sans query, IDs numériques → :id). */
export function normalizeApiPath(raw: string): string {
  let path = raw.split('?')[0] || '/'
  if (!path.startsWith('/')) path = `/${path}`
  // Strip basePath if present in URL pathname used by Node (usually already without host)
  path = path.replace(/\/\d+(?=\/|$)/g, '/:id')
  if (path.length > 120) path = path.slice(0, 120)
  return path
}

function prune(now: number) {
  const s = store()
  const cutoff = now - WINDOW_MS
  while (s.events.length && s.events[0].at < cutoff) s.events.shift()
  while (s.events.length > MAX_EVENTS) s.events.shift()

  const bucketCutoff = now - BUCKET_MS * BUCKET_COUNT
  while (s.buckets.length && s.buckets[0].start < bucketCutoff) s.buckets.shift()

  const enqueueCutoff = now - WINDOW_MS
  s.poolEnqueueRecent = s.poolEnqueueRecent.filter((t) => t >= enqueueCutoff)
}

function currentBucket(now: number) {
  const s = store()
  const start = Math.floor(now / BUCKET_MS) * BUCKET_MS
  let b = s.buckets[s.buckets.length - 1]
  if (!b || b.start !== start) {
    b = { start, count: 0, errorCount: 0, totalMs: 0 }
    s.buckets.push(b)
  }
  return b
}

export function recordApiRequest(input: {
  path: string
  status: number
  durationMs: number
  at?: number
}): void {
  const now = input.at ?? Date.now()
  const s = store()
  const path = normalizeApiPath(input.path)
  if (!path.startsWith('/api')) return
  // Ne pas compter le endpoint de métriques lui-même (poll admin).
  if (path.startsWith('/api/admin/load') || path === '/api/health' || path === '/api/health/live') {
    return
  }

  const ms = Math.max(0, Math.round(input.durationMs))
  const status = Number.isFinite(input.status) ? input.status : 0
  s.events.push({ at: now, path, status, ms })
  const b = currentBucket(now)
  b.count += 1
  b.totalMs += ms
  if (status >= 500) b.errorCount += 1
  prune(now)
}

export function recordPoolEnqueue(at?: number): void {
  const now = at ?? Date.now()
  const s = store()
  s.poolEnqueueTotal += 1
  s.poolEnqueueRecent.push(now)
  prune(now)
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? 0
}

function aggregatePaths(events: RequestEvent[]): PathStats[] {
  const map = new Map<string, { ms: number[]; errors: number }>()
  for (const e of events) {
    let row = map.get(e.path)
    if (!row) {
      row = { ms: [], errors: 0 }
      map.set(e.path, row)
    }
    row.ms.push(e.ms)
    if (e.status >= 500) row.errors += 1
  }
  const out: PathStats[] = []
  for (const [path, row] of map) {
    const sorted = [...row.ms].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)
    out.push({
      path,
      count: sorted.length,
      errors: row.errors,
      avgMs: sorted.length ? Math.round(sum / sorted.length) : 0,
      p95Ms: Math.round(percentile(sorted, 95)),
    })
  }
  return out
}

export function getLoadSnapshot(): LoadSnapshot {
  const now = Date.now()
  prune(now)
  const s = store()
  const events = s.events
  const requests = events.length
  const errors = events.filter((e) => e.status >= 500).length
  const msSorted = events.map((e) => e.ms).sort((a, b) => a - b)
  const sumMs = msSorted.reduce((a, b) => a + b, 0)
  const windowSec = WINDOW_MS / 1000
  const paths = aggregatePaths(events)
  const topSlow = [...paths].sort((a, b) => b.p95Ms - a.p95Ms || b.avgMs - a.avgMs).slice(0, 8)
  const topErrors = [...paths]
    .filter((p) => p.errors > 0)
    .sort((a, b) => b.errors - a.errors || b.count - a.count)
    .slice(0, 8)

  // Cap path cardinality noise
  if (paths.length > MAX_PATHS) {
    /* ok — we only expose tops */
  }

  const series = s.buckets.map((b) => ({
    at: b.start,
    rps: Number((b.count / (BUCKET_MS / 1000)).toFixed(2)),
    avgMs: b.count ? Math.round(b.totalMs / b.count) : 0,
    errors: b.errorCount,
  }))

  return {
    windowSec,
    rps: Number((requests / windowSec).toFixed(2)),
    avgMs: requests ? Math.round(sumMs / requests) : 0,
    p95Ms: Math.round(percentile(msSorted, 95)),
    requests,
    errors,
    errorRate: requests ? Number((errors / requests).toFixed(3)) : 0,
    topSlow,
    topErrors,
    series,
    poolEnqueueTotal: s.poolEnqueueTotal,
    poolEnqueueRecent: s.poolEnqueueRecent.length,
    startedAt: s.startedAt,
  }
}

/** Reset tests uniquement. */
export function __resetRequestMetricsForTests(): void {
  globalThis.__mdl_request_metrics = undefined
}
