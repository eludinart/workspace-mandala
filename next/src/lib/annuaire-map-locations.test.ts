import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { locationsForMapSource } from './annuaire-map-locations'

describe('locationsForMapSource', () => {
  it('emits one pin per practice city', () => {
    const locs = locationsForMapSource({
      practice_places: [
        {
          city: 'Tours',
          mode: 'city',
          address: '',
          postal_code: '',
          latitude: null,
          longitude: null,
        },
        {
          city: 'Chinon',
          mode: 'city',
          address: '',
          postal_code: '',
          latitude: null,
          longitude: null,
        },
        {
          city: 'Amboise',
          mode: 'city',
          address: '',
          postal_code: '',
          latitude: null,
          longitude: null,
        },
      ],
      residence_public: false,
    })
    assert.equal(locs.length, 3)
    assert.deepEqual(
      locs.map((l) => l.label),
      ['Tours', 'Chinon', 'Amboise']
    )
    assert.ok(locs.every((l) => l.kind === 'practice'))
  })

  it('adds residence when public and distinct', () => {
    const locs = locationsForMapSource({
      practice_locations: ['Chinon'],
      residence_city: 'Tours',
      residence_public: true,
    })
    assert.equal(locs.length, 2)
    assert.equal(locs[0].kind, 'practice')
    assert.equal(locs[0].label, 'Chinon')
    assert.equal(locs[1].kind, 'residence')
    assert.equal(locs[1].label, 'Tours')
  })

  it('does not duplicate residence same as practice city', () => {
    const locs = locationsForMapSource({
      practice_locations: ['Tours'],
      residence_city: 'tours',
      residence_public: true,
    })
    assert.equal(locs.length, 1)
    assert.equal(locs[0].kind, 'practice')
  })
})
