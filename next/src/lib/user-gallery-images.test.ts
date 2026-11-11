import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertUserGalleryImageDataUrls,
  skillScopeRequiresPortrait,
  USER_GALLERY_MAX_IMAGES,
} from './user-gallery-images'

function tinyJpegDataUrl(): string {
  const b64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z'
  return `data:image/jpeg;base64,${b64}`
}

describe('assertUserGalleryImageDataUrls', () => {
  it('accepte un tableau vide', () => {
    assert.deepEqual(assertUserGalleryImageDataUrls([]), [])
    assert.deepEqual(assertUserGalleryImageDataUrls(null), [])
  })

  it('accepte jusqu’à 2 images valides', () => {
    const img = tinyJpegDataUrl()
    assert.equal(assertUserGalleryImageDataUrls([img, img]).length, 2)
  })

  it('refuse plus de 2 images', () => {
    const img = tinyJpegDataUrl()
    assert.throws(
      () =>
        assertUserGalleryImageDataUrls(
          Array.from({ length: USER_GALLERY_MAX_IMAGES + 1 }, () => img)
        ),
      /Maximum/
    )
  })

  it('refuse un format non image', () => {
    assert.throws(() => assertUserGalleryImageDataUrls(['not-an-image']), /data URL/)
  })
})

describe('skillScopeRequiresPortrait', () => {
  it('exige un portrait pour mandala et places', () => {
    assert.equal(skillScopeRequiresPortrait('mandala'), true)
    assert.equal(skillScopeRequiresPortrait('places'), true)
  })

  it('n’exige pas pour hidden', () => {
    assert.equal(skillScopeRequiresPortrait('hidden'), false)
  })
})
