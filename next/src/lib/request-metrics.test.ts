import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  __resetRequestMetricsForTests,
  getLoadSnapshot,
  normalizeApiPath,
  recordApiRequest,
  recordPoolEnqueue,
} from './request-metrics'

describe('normalizeApiPath', () => {
  it('retire query et anonymise les ids numériques', () => {
    assert.equal(normalizeApiPath('/api/events/42/tasks?x=1'), '/api/events/:id/tasks')
  })
})

describe('request metrics', () => {
  beforeEach(() => {
    __resetRequestMetricsForTests()
  })

  it('calcule RPS et latence moyenne sur la fenêtre', () => {
    const t0 = Date.now()
    recordApiRequest({ path: '/api/foo', status: 200, durationMs: 40, at: t0 })
    recordApiRequest({ path: '/api/foo', status: 200, durationMs: 60, at: t0 + 10 })
    recordApiRequest({ path: '/api/bar', status: 500, durationMs: 200, at: t0 + 20 })
    const snap = getLoadSnapshot()
    assert.equal(snap.requests, 3)
    assert.equal(snap.errors, 1)
    assert.equal(snap.avgMs, 100)
    assert.ok(snap.topErrors.some((p) => p.path === '/api/bar' && p.errors === 1))
  })

  it('ignore health et admin/load', () => {
    recordApiRequest({ path: '/api/health', status: 200, durationMs: 5 })
    recordApiRequest({ path: '/api/admin/load', status: 200, durationMs: 5 })
    assert.equal(getLoadSnapshot().requests, 0)
  })

  it('compte les enqueue pool', () => {
    recordPoolEnqueue()
    recordPoolEnqueue()
    const snap = getLoadSnapshot()
    assert.equal(snap.poolEnqueueTotal, 2)
    assert.equal(snap.poolEnqueueRecent, 2)
  })
})
