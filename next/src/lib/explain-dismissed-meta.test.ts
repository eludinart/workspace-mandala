import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  mergeDismissedMetaValues,
  serializeDismissedScreens,
} from './explain-dismissed-meta'

describe('mergeDismissedMetaValues', () => {
  it('merges duplicate usermeta rows so later dismissals are not lost', () => {
    // Repro: INSERT sans UNIQUE → plusieurs lignes ; LIMIT 1 peut renvoyer l’ancienne.
    const merged = mergeDismissedMetaValues([
      '["home"]',
      '["home","heart_weather"]',
    ]).sort()
    assert.deepEqual(merged, ['heart_weather', 'home'])
  })

  it('returns empty for missing or invalid values', () => {
    assert.deepEqual(mergeDismissedMetaValues([]), [])
    assert.deepEqual(mergeDismissedMetaValues(['not-json', '{"a":1}']), [])
  })
})

describe('serializeDismissedScreens', () => {
  it('dedupes and serializes as JSON array', () => {
    assert.equal(
      serializeDismissedScreens(['heart_weather', 'home', 'heart_weather']),
      '["heart_weather","home"]'
    )
  })
})
