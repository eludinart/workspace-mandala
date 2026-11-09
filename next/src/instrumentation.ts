/**
 * Instrumentation Node (standalone Coolify) : chronomètre les réponses /api/*.
 * Évite `node:` URI (Webpack/Next build) → require('http') uniquement côté Node.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const http = require('http') as typeof import('http')
  const { recordApiRequest } = await import('@/lib/request-metrics')

  const originalEmit = http.Server.prototype.emit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  http.Server.prototype.emit = function (this: unknown, event: string, ...args: any[]) {
    if (event === 'request') {
      const req = args[0] as { url?: string }
      const res = args[1] as { statusCode: number; once: (ev: string, fn: () => void) => void }
      const start = Date.now()
      const url = String(req.url ?? '')
      if (url.includes('/api')) {
        res.once('finish', () => {
          try {
            const pathOnly = url.split('?')[0] ?? url
            const apiIdx = pathOnly.indexOf('/api')
            const path = apiIdx >= 0 ? pathOnly.slice(apiIdx) : pathOnly
            recordApiRequest({
              path,
              status: res.statusCode || 0,
              durationMs: Date.now() - start,
            })
          } catch {
            /* ne jamais casser la réponse */
          }
        })
      }
    }
    return originalEmit.apply(this, [event, ...args] as never)
  }
}
