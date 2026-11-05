import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  normalizeCityLabel,
  normalizePracticeLocations,
  normalizePracticePlaces,
  practiceLocationsFromJson,
  practicePlaceLabels,
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

  it('reads json column legacy strings', () => {
    assert.deepEqual(practicePlaceLabels(practiceLocationsFromJson('["Tours","Chinon"]')), [
      'Tours',
      'Chinon',
    ])
  })

  it('reads rich practice places', () => {
    const places = normalizePracticePlaces([
      {
        city: 'Tourves',
        mode: 'address',
        address: '1 rue Test',
        postal_code: '83170',
        latitude: 43.4,
        longitude: 5.9,
      },
    ])
    assert.equal(places.length, 1)
    assert.equal(places[0].mode, 'address')
    assert.equal(places[0].address, '1 rue Test')
    assert.equal(places[0].latitude, 43.4)
  })
})

describe('normalizeCityLabel', () => {
  it('slices length', () => {
    assert.equal(normalizeCityLabel('  A  B  ').length <= 120, true)
    assert.equal(normalizeCityLabel('  A  B  '), 'A B')
  })
})
