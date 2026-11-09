import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planMemberMapLocationsForTest } from './db-member-city'

const member = {
  user_id: 7,
  display_name: 'Marie',
  avatar: null,
  avatar_emoji: '🌸',
  fallback_city: 'Tours',
}

describe('planMemberMapLocationsForTest', () => {
  it('uses practice locations when skills present (3 villes)', () => {
    const locs = planMemberMapLocationsForTest(member, {
      practice_locations: [
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
      residence_city: '',
      residence_public: true,
      location_mode: 'city',
      latitude: null,
      longitude: null,
    })
    assert.equal(locs.length, 3)
  })

  it('falls back to member city when no skills locations', () => {
    const locs = planMemberMapLocationsForTest(member, undefined)
    assert.equal(locs.length, 1)
    assert.equal(locs[0].label, 'Tours')
    assert.equal(locs[0].kind, 'residence')
  })

  it('returns empty when no skills and no fallback city', () => {
    const locs = planMemberMapLocationsForTest(
      { ...member, fallback_city: '' },
      {
        practice_locations: [],
        residence_city: '',
        residence_public: true,
        location_mode: 'city',
        latitude: null,
        longitude: null,
      }
    )
    assert.equal(locs.length, 0)
  })
})
