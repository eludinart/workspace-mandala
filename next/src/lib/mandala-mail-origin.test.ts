import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { resolvePublicAppOrigin } from './mandala-mail'

const ORIGINAL_ENV = {
  APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV,
}

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('resolvePublicAppOrigin', () => {
  it('prefers a public request origin over a baked localhost NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3002'
    delete process.env.APP_PUBLIC_URL

    assert.equal(
      resolvePublicAppOrigin('https://mandala.eludein.art'),
      'https://mandala.eludein.art'
    )
  })

  it('uses APP_PUBLIC_URL at runtime even when NEXT_PUBLIC points to localhost', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3002'
    process.env.APP_PUBLIC_URL = 'https://mandala.eludein.art'

    assert.equal(resolvePublicAppOrigin(null), 'https://mandala.eludein.art')
  })

  it('falls back to production URL instead of localhost when nothing public is available', () => {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3002'
    delete process.env.APP_PUBLIC_URL

    assert.equal(resolvePublicAppOrigin(null), 'https://mandala.eludein.art')
  })

  it('keeps localhost in development when that is the only origin', () => {
    process.env.NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3002'
    delete process.env.APP_PUBLIC_URL

    assert.equal(resolvePublicAppOrigin(null), 'http://localhost:3002')
  })
})
