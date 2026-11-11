import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parisDayString } from './paris-day'

describe('parisDayString', () => {
  it('returns YYYY-MM-DD for a known Paris civil day', () => {
    // Après minuit Paris en hiver (UTC+1)
    assert.equal(parisDayString(new Date('2026-11-11T15:00:00+01:00')), '2026-11-11')
  })
})
