import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isSkillProfileVisibleOnMandala,
  needsExploreProfileNudge,
  skillProfileHasContent,
} from './skill-profile-visibility'

describe('skillProfileHasContent', () => {
  it('is false when empty', () => {
    assert.equal(skillProfileHasContent({ scope: 'hidden', tags: [], offer_text: '', seek_text: '' }), false)
  })

  it('is true with a tag, offer, or seek', () => {
    assert.equal(skillProfileHasContent({ scope: 'hidden', tags: [{ label: 'Yoga' }] }), true)
    assert.equal(skillProfileHasContent({ scope: 'hidden', offer_text: 'Ateliers' }), true)
    assert.equal(skillProfileHasContent({ scope: 'hidden', seek_text: 'Jardinage' }), true)
  })
})

describe('needsExploreProfileNudge (règle 1)', () => {
  it('nudges new / hidden / empty mandala profiles', () => {
    assert.equal(needsExploreProfileNudge({ scope: 'hidden' }), true)
    assert.equal(
      needsExploreProfileNudge({ scope: 'hidden', tags: [{ label: 'Yoga' }], offer_text: '' }),
      true
    )
    assert.equal(needsExploreProfileNudge({ scope: 'mandala', tags: [], offer_text: '', seek_text: '' }), true)
    assert.equal(needsExploreProfileNudge({ scope: 'places', tags: [{ label: 'Yoga' }] }), true)
  })

  it('stops when mandala + content', () => {
    assert.equal(
      needsExploreProfileNudge({ scope: 'mandala', tags: [{ label: 'Yoga' }] }),
      false
    )
    assert.equal(isSkillProfileVisibleOnMandala({ scope: 'mandala', offer_text: 'Cours' }), true)
  })
})
