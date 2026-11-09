import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildAppPathWithPreservedBridge,
  extractNativeFcmToken,
  isPlausibleFcmToken,
  mergePreservedAppSearchParams,
  NATIVE_FCM_PARAM,
} from './native-fcm-bridge'

const SAMPLE_TOKEN =
  'dGVzdC1mY20tdG9rZW4tYW5kcm9pZC1sb25nLWVub3VnaC1mb3ItZmNtLXJlZ2lzdHJhdGlvbg'

describe('native-fcm-bridge', () => {
  it('rejects short tokens', () => {
    assert.equal(isPlausibleFcmToken('short'), false)
    assert.equal(isPlausibleFcmToken(SAMPLE_TOKEN), true)
  })

  it('reads fcm_token from query first', () => {
    const token = extractNativeFcmToken({
      search: `?page=home&${NATIVE_FCM_PARAM}=${SAMPLE_TOKEN}&dist=play`,
      cookieHeader: 'mdl_fcm_token=cookie-token-which-is-also-long-enough-xx',
      stored: 'stored-token-which-is-also-long-enough-xx',
    })
    assert.equal(token, SAMPLE_TOKEN)
  })

  it('falls back to cookie then local storage', () => {
    const cookieTok = 'cookie-token-which-is-also-long-enough-xx'
    assert.equal(
      extractNativeFcmToken({
        search: '?page=home',
        cookieHeader: `foo=1; mdl_fcm_token=${cookieTok}; bar=2`,
      }),
      cookieTok
    )
    const stored = 'stored-token-which-is-also-long-enough-xx'
    assert.equal(
      extractNativeFcmToken({
        search: '?page=home',
        cookieHeader: '',
        stored,
      }),
      stored
    )
  })

  it('preserves fcm_token when history rewrites to page=home', () => {
    const nav = new URLSearchParams()
    nav.set('page', 'home')
    const merged = mergePreservedAppSearchParams(
      nav,
      `?page=home&fcm_token=${SAMPLE_TOKEN}&dist=play&noise=1`
    )
    assert.equal(merged.get('page'), 'home')
    assert.equal(merged.get('fcm_token'), SAMPLE_TOKEN)
    assert.equal(merged.get('dist'), 'play')
    assert.equal(merged.get('noise'), null)
  })

  it('buildAppPathWithPreservedBridge keeps the bridge across strip', () => {
    const path = buildAppPathWithPreservedBridge({
      page: 'home',
      currentSearch: `?fcm_token=${SAMPLE_TOKEN}&dist=play`,
    })
    assert.ok(path.includes('page=home'))
    const qs = new URLSearchParams(path.slice(path.indexOf('?') + 1))
    assert.equal(qs.get('fcm_token'), SAMPLE_TOKEN)
    assert.equal(qs.get('dist'), 'play')
  })

  it('simulates the MandalaApp race: naive strip loses token, merge keeps it', () => {
    const before = `?dist=play&fcm_token=${SAMPLE_TOKEN}`
    const afterStripNaive = new URLSearchParams('page=home')
    assert.equal(afterStripNaive.get('fcm_token'), null)

    const fixed = buildAppPathWithPreservedBridge({
      page: 'home',
      currentSearch: before,
    })
    const qs = new URLSearchParams(fixed.slice(fixed.indexOf('?') + 1))
    assert.equal(qs.get('fcm_token'), SAMPLE_TOKEN)
    assert.equal(extractNativeFcmToken({ search: `?${qs.toString()}` }), SAMPLE_TOKEN)
  })
})
