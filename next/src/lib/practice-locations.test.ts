import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  normalizeCityLabel,
  normalizePracticeLocations,
  practiceLocationsFromJson,
} from './practice-locations'

describe('normalizePracticeLocations', () => {
  it('dedupes and trims', () => {
    assert.deepEqual(normalizePracticeLocations([' Tours ', 'tours', 'Chinon']), [
      'Tours',
      'Chinon',
    ])
  })

  it('parses comma string', () => {
    assert.deepEqual(normalizePracticeLocations('Tours, Chinon ; Amboise'), [
      'Tours',
      'Chinon',
      'Amboise',
    ])
  })

  it('reads json column', () => {
    assert.deepEqual(practiceLocationsFromJson('["Tours","Chinon"]'), ['Tours', 'Chinon'])
  })
})

describe('normalizeCityLabel', () => {
  it('slices length', () => {
    assert.equal(normalizeCityLabel('  A  B  ').length <= 120, true)
    assert.equal(normalizeCityLabel('  A  B  '), 'A B')
  })
})
