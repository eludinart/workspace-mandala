import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isSoftPullRefreshPage,
  registerPullRefreshHandler,
  runPullRefresh,
} from './pull-refresh'

describe('isSoftPullRefreshPage', () => {
  it('marks home/events/messages soft and admin/account hard', () => {
    assert.equal(isSoftPullRefreshPage('home'), true)
    assert.equal(isSoftPullRefreshPage('events'), true)
    assert.equal(isSoftPullRefreshPage('messages'), true)
    assert.equal(isSoftPullRefreshPage('members'), true)
    assert.equal(isSoftPullRefreshPage('notifications'), true)
    assert.equal(isSoftPullRefreshPage('places-map'), true)
    assert.equal(isSoftPullRefreshPage('admin'), false)
    assert.equal(isSoftPullRefreshPage('account'), false)
    assert.equal(isSoftPullRefreshPage('managed-places'), false)
  })
})

describe('runPullRefresh', () => {
  it('runs registered soft handlers', async () => {
    let called = 0
    const unsub = registerPullRefreshHandler('home', async () => {
      called += 1
    })
    const result = await runPullRefresh('home')
    assert.equal(result, 'soft-ok')
    assert.equal(called, 1)
    unsub()
  })

  it('returns soft-error when a handler throws', async () => {
    const unsub = registerPullRefreshHandler('events', async () => {
      throw new Error('boom')
    })
    const result = await runPullRefresh('events')
    assert.equal(result, 'soft-error')
    unsub()
  })

  it('returns hard when page is hard or soft has no handler', async () => {
    assert.equal(await runPullRefresh('admin'), 'hard')
    assert.equal(await runPullRefresh('courses'), 'hard')
  })
})
