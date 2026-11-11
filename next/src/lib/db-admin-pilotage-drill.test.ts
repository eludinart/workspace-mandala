import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isPilotageDrillKind,
  normalizeSeriesMetric,
  parseDrillQuery,
  pilotageDrillTitle,
} from './db-admin-pilotage-drill'

describe('isPilotageDrillKind', () => {
  it('accepts known kinds', () => {
    assert.equal(isPilotageDrillKind('registrations'), true)
    assert.equal(isPilotageDrillKind('series_day'), true)
    assert.equal(isPilotageDrillKind('nope'), false)
  })
})

describe('normalizeSeriesMetric', () => {
  it('defaults to registrations', () => {
    assert.equal(normalizeSeriesMetric(undefined), 'registrations')
    assert.equal(normalizeSeriesMetric('dau'), 'dau')
  })
})

describe('pilotageDrillTitle', () => {
  it('labels series day', () => {
    assert.equal(
      pilotageDrillTitle({
        kind: 'series_day',
        days: 7,
        day: '2026-11-11',
        metric: 'joins',
      }),
      'Joins — 2026-11-11'
    )
  })
})

describe('parseDrillQuery', () => {
  it('parses valid query', () => {
    const q = parseDrillQuery(
      new URLSearchParams('kind=dau&days=30&cursor=50&limit=20')
    )
    assert.equal(q.kind, 'dau')
    assert.equal(q.days, 30)
    assert.equal(q.cursor, '50')
    assert.equal(q.limit, 20)
  })
  it('rejects invalid kind', () => {
    assert.throws(() => parseDrillQuery(new URLSearchParams('kind=x')))
  })
})
