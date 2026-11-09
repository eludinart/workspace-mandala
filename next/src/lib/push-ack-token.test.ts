import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { signPushAck, verifyPushAck } from './push-ack-token'
import { platformFromUserAgent } from './push-platform'

describe('push-ack-token', () => {
  it('signs and verifies sendId', () => {
    const sig = signPushAck(42)
    assert.equal(verifyPushAck(42, sig), true)
    assert.equal(verifyPushAck(43, sig), false)
    assert.equal(verifyPushAck(42, 'nope'), false)
  })

  it('maps user agents to platforms', () => {
    assert.equal(platformFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios')
    assert.equal(platformFromUserAgent('Mozilla/5.0 (Linux; Android 14)'), 'android')
    assert.equal(platformFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop')
    assert.equal(platformFromUserAgent(''), 'unknown')
  })
})
