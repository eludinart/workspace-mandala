import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  featuredProgramMediaKind,
  resolveFeaturedProgramImage,
} from './featured-program-media'

describe('resolveFeaturedProgramImage', () => {
  it('prefers cover_image over gallery media', () => {
    assert.equal(
      resolveFeaturedProgramImage({
        cover_image: 'https://cdn.example/cover.jpg',
        first_media_image: 'https://cdn.example/gallery.jpg',
      }),
      'https://cdn.example/cover.jpg',
    )
  })

  it('falls back to first gallery media when cover is missing', () => {
    assert.equal(
      resolveFeaturedProgramImage({
        cover_image: null,
        first_media_image: 'https://cdn.example/gallery.jpg',
      }),
      'https://cdn.example/gallery.jpg',
    )
    assert.equal(
      resolveFeaturedProgramImage({
        cover_image: '  ',
        first_media_image: 'data:image/jpeg;base64,abc',
      }),
      'data:image/jpeg;base64,abc',
    )
  })

  it('returns null when neither cover nor media is available', () => {
    assert.equal(resolveFeaturedProgramImage({ cover_image: null }), null)
    assert.equal(
      resolveFeaturedProgramImage({ cover_image: '', first_media_image: '  ' }),
      null,
    )
  })
})

describe('featuredProgramMediaKind', () => {
  it('uses image when a resolved URL is present', () => {
    assert.equal(featuredProgramMediaKind('https://cdn.example/cover.jpg'), 'image')
  })

  it('uses a date placeholder when no image — never a full event card', () => {
    assert.equal(featuredProgramMediaKind(null), 'date-placeholder')
    assert.equal(featuredProgramMediaKind(undefined), 'date-placeholder')
    assert.equal(featuredProgramMediaKind(''), 'date-placeholder')
    assert.equal(featuredProgramMediaKind('   '), 'date-placeholder')
  })
})
