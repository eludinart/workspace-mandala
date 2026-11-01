import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolvePlaceFriendsAccess } from './place-friends-access'

describe('resolvePlaceFriendsAccess', () => {
  it('allows public graph for a listed place without auth', () => {
    assert.deepEqual(
      resolvePlaceFriendsAccess({
        sourceListedPublic: true,
        isAuthenticated: false,
        hasLieuxLiesDoor: false,
      }),
      { mode: 'listed-public', can_view: true },
    )
  })

  it('denies unlisted place for anonymous visitors', () => {
    assert.deepEqual(
      resolvePlaceFriendsAccess({
        sourceListedPublic: false,
        isAuthenticated: false,
        hasLieuxLiesDoor: false,
      }),
      { mode: 'none', can_view: false },
    )
  })

  it('allows full friends list when door is open', () => {
    assert.deepEqual(
      resolvePlaceFriendsAccess({
        sourceListedPublic: false,
        isAuthenticated: true,
        hasLieuxLiesDoor: true,
      }),
      { mode: 'all-accepted', can_view: true },
    )
  })

  it('falls back to listed-public graph for authenticated users without the door', () => {
    assert.deepEqual(
      resolvePlaceFriendsAccess({
        sourceListedPublic: true,
        isAuthenticated: true,
        hasLieuxLiesDoor: false,
      }),
      { mode: 'listed-public', can_view: true },
    )
  })
})
