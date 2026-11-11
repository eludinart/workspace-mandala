import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildProductAlerts,
  enumerateParisDaysInclusive,
  mergeSeriesCounts,
  normalizePilotageDays,
  pilotageActivityToCsv,
  pilotageSeriesToCsv,
  rowsToDayCountMap,
  shiftParisDay,
  type PilotageKpis,
  type PilotageFunnel,
  type PilotagePlaceHealth,
} from './db-admin-pilotage'

describe('normalizePilotageDays', () => {
  it('defaults to 7', () => {
    assert.equal(normalizePilotageDays(undefined), 7)
    assert.equal(normalizePilotageDays(''), 7)
    assert.equal(normalizePilotageDays('12'), 7)
  })
  it('accepts 1, 30, 90 and 365', () => {
    assert.equal(normalizePilotageDays('1'), 1)
    assert.equal(normalizePilotageDays('30'), 30)
    assert.equal(normalizePilotageDays('90'), 90)
    assert.equal(normalizePilotageDays('365'), 365)
  })
})

describe('enumerateParisDaysInclusive / shiftParisDay', () => {
  it('lists inclusive days', () => {
    assert.deepEqual(enumerateParisDaysInclusive('2026-11-09', '2026-11-11'), [
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ])
  })
  it('shifts days', () => {
    assert.equal(shiftParisDay('2026-11-11', -6), '2026-11-05')
  })
})

describe('mergeSeriesCounts', () => {
  it('fills zeros', () => {
    const series = mergeSeriesCounts(
      ['2026-11-10', '2026-11-11'],
      rowsToDayCountMap([{ day: '2026-11-11', n: 2 }]),
      new Map(),
      rowsToDayCountMap([{ day: '2026-11-10', n: 5 }])
    )
    assert.deepEqual(series, [
      { day: '2026-11-10', registrations: 0, joins: 0, dau: 5 },
      { day: '2026-11-11', registrations: 2, joins: 0, dau: 0 },
    ])
  })
})

describe('csv helpers', () => {
  it('exports series', () => {
    const csv = pilotageSeriesToCsv([
      { day: '2026-11-11', registrations: 1, joins: 2, dau: 3 },
    ])
    assert.equal(csv, 'day,registrations,joins,dau\n2026-11-11,1,2,3')
  })
  it('escapes activity labels', () => {
    const csv = pilotageActivityToCsv([
      {
        at: '2026-11-11 10:00:00',
        kind: 'user.registered',
        user_id: 1,
        user_label: 'A, "B"',
        community_id: null,
        community_name: null,
      },
    ])
    assert.ok(csv.includes('"A, ""B"""'))
  })
})

describe('buildProductAlerts', () => {
  const baseKpis: PilotageKpis = {
    total_users: 10,
    registrations: 5,
    joins: 0,
    continue_without_place: 1,
    active_24h: 0,
    dau: 0,
    wau: 0,
    mau: 0,
  }
  const baseFunnel: PilotageFunnel = {
    registered: 0,
    chose_place: 0,
    continue_without_place: 0,
    active_d1: 0,
    active_d7: 0,
  }
  const places: PilotagePlaceHealth[] = []

  it('warns when registrations without joins', () => {
    const alerts = buildProductAlerts({
      kpis: baseKpis,
      funnel: baseFunnel,
      places,
      days: 7,
    })
    assert.ok(alerts.some((a) => a.id === 'pilotage-no-joins'))
    assert.ok(alerts.some((a) => a.id === 'pilotage-zero-dau'))
  })
})
