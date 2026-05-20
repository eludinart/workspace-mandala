#!/usr/bin/env node
/** Sonde HTTP locale pour HEALTHCHECK Docker (sans fetch global). */
import http from 'node:http'

const port = Number(process.env.PORT || 3000)
const path = '/api/health/live'

const req = http.get(
  { host: '127.0.0.1', port, path, timeout: 4000 },
  (res) => {
    res.resume()
    process.exit(res.statusCode === 200 ? 0 : 1)
  }
)
req.on('error', () => process.exit(1))
req.on('timeout', () => {
  req.destroy()
  process.exit(1)
})
