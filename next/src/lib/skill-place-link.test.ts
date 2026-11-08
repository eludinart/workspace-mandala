import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { publicPlaceProfileHref } from './skill-place-link'

describe('publicPlaceProfileHref', () => {
  it('returns public fiche href when profile_public is true', () => {
    assert.equal(
      publicPlaceProfileHref({ slug: 'sivana', profile_public: true }),
      '/lieux/sivana'
    )
  })

  it('encodes slug', () => {
    assert.equal(
      publicPlaceProfileHref({ slug: 'terre-deveil', profile_public: true }),
      '/lieux/terre-deveil'
    )
  })

  it('returns null when profile is private (avoids /lieux 404)', () => {
    assert.equal(
      publicPlaceProfileHref({ slug: 'shambala', profile_public: false }),
      null
    )
  })

  it('returns null for empty slug', () => {
    assert.equal(publicPlaceProfileHref({ slug: '  ', profile_public: true }), null)
  })

  it('defaults to link when profile_public is omitted', () => {
    assert.equal(publicPlaceProfileHref({ slug: 'graine-de-vie' }), '/lieux/graine-de-vie')
  })
})
