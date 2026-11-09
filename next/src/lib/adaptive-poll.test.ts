import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  POLL_INTERVALS_MS,
  resolvePollIntervalMs,
  type PollKind,
} from './adaptive-poll'

describe('resolvePollIntervalMs', () => {
  const kinds: PollKind[] = ['notifications', 'chat_thread', 'channels', 'presence']

  for (const kind of kinds) {
    it(`${kind} : intervalle visible strictement positif`, () => {
      const ms = resolvePollIntervalMs(kind, 'visible')
      assert.equal(typeof ms, 'number')
      assert.ok((ms as number) > 0)
      assert.equal(ms, POLL_INTERVALS_MS[kind].visible)
    })

    it(`${kind} : pause totale quand l’onglet est caché`, () => {
      assert.equal(resolvePollIntervalMs(kind, 'hidden'), null)
    })
  }

  it('chat_thread reste à 15 s (réactivité messages)', () => {
    assert.equal(resolvePollIntervalMs('chat_thread', 'visible'), 15_000)
  })

  it('channels reste à 60 s', () => {
    assert.equal(resolvePollIntervalMs('channels', 'visible'), 60_000)
  })

  it('presence reste à 120 s', () => {
    assert.equal(resolvePollIntervalMs('presence', 'visible'), 120_000)
  })

  it('notifications seules passent à 45 s', () => {
    assert.equal(resolvePollIntervalMs('notifications', 'visible'), 45_000)
  })
})
