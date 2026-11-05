import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PLACE_FREE_MEMBER_CAP,
  PLACE_FREE_MEMBER_SOFT_AT,
  PLACE_MEMBER_CAP_REACHED_CODE,
  canAcceptNewPlaceMember,
  canAccessFeature,
  compareSkillBoost,
  placeMemberCapState,
  type EntitlementFlags,
} from './billing-entitlements'

const base: EntitlementFlags = {
  isAppAdmin: false,
  billingPublic: true,
  placeActive: false,
  proActive: false,
  proVerified: false,
  memberCovered: false,
}

describe('canAccessFeature', () => {
  it('allows social_core for everyone', () => {
    assert.equal(canAccessFeature(base, 'social_core'), true)
  })

  it('denies place_listed_public without place plan', () => {
    assert.equal(canAccessFeature(base, 'place_listed_public'), false)
  })

  it('allows place_listed_public with place plan', () => {
    assert.equal(
      canAccessFeature({ ...base, placeActive: true }, 'place_listed_public'),
      true
    )
  })

  it('allows pro_skills_boost only when proActive', () => {
    assert.equal(canAccessFeature(base, 'pro_skills_boost'), false)
    assert.equal(
      canAccessFeature({ ...base, proActive: true }, 'pro_skills_boost'),
      true
    )
  })

  it('allows pro_badge only when proActive and proVerified', () => {
    assert.equal(
      canAccessFeature({ ...base, proActive: true }, 'pro_badge'),
      false
    )
    assert.equal(
      canAccessFeature(
        { ...base, proActive: true, proVerified: true },
        'pro_badge'
      ),
      true
    )
  })

  it('hides paid CTAs when billing door closed unless admin', () => {
    assert.equal(
      canAccessFeature(
        { ...base, billingPublic: false, placeActive: true },
        'billing_cta'
      ),
      false
    )
    assert.equal(
      canAccessFeature(
        { ...base, billingPublic: false, isAppAdmin: true },
        'billing_cta'
      ),
      true
    )
  })
})

describe('compareSkillBoost', () => {
  it('puts Mandala Pro boost first', () => {
    const list = [
      { proBoost: false, label: 'Alice' },
      { proBoost: true, label: 'Zoé' },
      { proBoost: true, label: 'Bob' },
    ]
    const sorted = [...list].sort(compareSkillBoost)
    assert.deepEqual(
      sorted.map((x) => x.label),
      ['Bob', 'Zoé', 'Alice']
    )
  })
})

describe('place member freemium cap', () => {
  it('exposes 40 cap and soft at 32', () => {
    assert.equal(PLACE_FREE_MEMBER_CAP, 40)
    assert.equal(PLACE_FREE_MEMBER_SOFT_AT, 32)
    assert.equal(PLACE_MEMBER_CAP_REACHED_CODE, 'place_member_cap_reached')
  })

  it('is ok under soft threshold when billing public and unpaid', () => {
    assert.equal(
      placeMemberCapState({
        billingPublic: true,
        placeActive: false,
        memberCount: 31,
      }),
      'ok'
    )
  })

  it('is soft from 32 to 39 when unpaid', () => {
    assert.equal(
      placeMemberCapState({
        billingPublic: true,
        placeActive: false,
        memberCount: 32,
      }),
      'soft'
    )
    assert.equal(
      placeMemberCapState({
        billingPublic: true,
        placeActive: false,
        memberCount: 39,
      }),
      'soft'
    )
  })

  it('is hard at 40+ when unpaid', () => {
    assert.equal(
      placeMemberCapState({
        billingPublic: true,
        placeActive: false,
        memberCount: 40,
      }),
      'hard'
    )
    assert.equal(
      placeMemberCapState({
        billingPublic: true,
        placeActive: false,
        memberCount: 55,
      }),
      'hard'
    )
  })

  it('skips cap when billing door closed or place active', () => {
    assert.equal(
      placeMemberCapState({
        billingPublic: false,
        placeActive: false,
        memberCount: 99,
      }),
      'ok'
    )
    assert.equal(
      placeMemberCapState({
        billingPublic: true,
        placeActive: true,
        memberCount: 99,
      }),
      'ok'
    )
  })

  it('allows 40th member then blocks 41st when unpaid', () => {
    assert.equal(
      canAcceptNewPlaceMember({
        billingPublic: true,
        placeActive: false,
        isAppAdmin: false,
        memberCount: 39,
      }),
      true
    )
    assert.equal(
      canAcceptNewPlaceMember({
        billingPublic: true,
        placeActive: false,
        isAppAdmin: false,
        memberCount: 40,
      }),
      false
    )
  })

  it('allows join when place paid, door closed, or app admin', () => {
    assert.equal(
      canAcceptNewPlaceMember({
        billingPublic: true,
        placeActive: true,
        isAppAdmin: false,
        memberCount: 200,
      }),
      true
    )
    assert.equal(
      canAcceptNewPlaceMember({
        billingPublic: false,
        placeActive: false,
        isAppAdmin: false,
        memberCount: 200,
      }),
      true
    )
    assert.equal(
      canAcceptNewPlaceMember({
        billingPublic: true,
        placeActive: false,
        isAppAdmin: true,
        memberCount: 200,
      }),
      true
    )
  })
})
