/**
 * Patch HTTP serveur Node — chargé uniquement via webpackIgnore depuis instrumentation.ts.
 */
'use strict'

function bootstrapHttpMetrics(recordApiRequest) {
  if (global.__mdl_http_metrics_patched) return
  global.__mdl_http_metrics_patched = true

  const http = require('http')
  const originalEmit = http.Server.prototype.emit
  http.Server.prototype.emit = function (event, ...args) {
    if (event === 'request') {
      const req = args[0]
      const res = args[1]
      const start = Date.now()
      const url = String(req && req.url ? req.url : '')
      if (url.includes('/api')) {
        res.once('finish', () => {
          try {
            const pathOnly = url.split('?')[0] || '/'
            const apiIdx = pathOnly.indexOf('/api')
            const path = apiIdx >= 0 ? pathOnly.slice(apiIdx) : pathOnly
            recordApiRequest({
              path,
              status: res.statusCode || 0,
              durationMs: Date.now() - start,
            })
          } catch (_) {
            /* ignore */
          }
        })
      }
    }
    return originalEmit.apply(this, [event, ...args])
  }
}

module.exports = { bootstrapHttpMetrics }
