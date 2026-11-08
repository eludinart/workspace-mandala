import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SUPPORT_MAX_IMAGES, assertSupportImageDataUrls } from './support-images'

describe('assertSupportImageDataUrls', () => {
  it('accepte un tableau vide ou absent', () => {
    assert.deepEqual(assertSupportImageDataUrls(undefined), [])
    assert.deepEqual(assertSupportImageDataUrls(null), [])
    assert.deepEqual(assertSupportImageDataUrls([]), [])
  })

  it('accepte jusqu’à 3 data URLs image', () => {
    const images = [
      'data:image/jpeg;base64,aaa',
      'data:image/png;base64,bbb',
      'data:image/webp;base64,ccc',
    ]
    assert.deepEqual(assertSupportImageDataUrls(images), images)
  })

  it('refuse plus de 3 images', () => {
    const images = Array.from(
      { length: SUPPORT_MAX_IMAGES + 1 },
      (_, i) => `data:image/jpeg;base64,${i}`
    )
    assert.throws(() => assertSupportImageDataUrls(images), /Maximum/)
  })

  it('refuse une URL non image', () => {
    assert.throws(() => assertSupportImageDataUrls(['https://example.com/a.png']), /data URL/)
  })
})
