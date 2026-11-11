import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatFcmErrorDetail } from './fcm'

describe('formatFcmErrorDetail', () => {
  it('formats HTTP status + body', () => {
    const d = formatFcmErrorDetail('http', {
      status: 403,
      body: '{"error":{"status":"PERMISSION_DENIED","message":"SenderId mismatch"}}',
    })
    assert.match(d, /^fcm_http_403 /)
    assert.match(d, /PERMISSION_DENIED/)
    assert.match(d, /SenderId mismatch/)
  })

  it('formats JSON response.error', () => {
    const d = formatFcmErrorDetail('response', {
      error: { status: 'INVALID_ARGUMENT', message: 'bad token' },
    })
    assert.match(d, /^fcm_response_error /)
    assert.match(d, /INVALID_ARGUMENT/)
  })

  it('truncates long bodies', () => {
    const d = formatFcmErrorDetail('http', { status: 500, body: 'x'.repeat(400) })
    assert.equal(d.length, 220)
    assert.match(d, /^fcm_http_500 /)
  })

  it('handles oauth / no_project without body', () => {
    assert.equal(formatFcmErrorDetail('oauth'), 'fcm_oauth')
    assert.equal(formatFcmErrorDetail('no_project'), 'fcm_no_project')
  })
})
