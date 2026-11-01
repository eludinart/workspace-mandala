import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canAccessFeature,
  compareSkillBoost,
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
