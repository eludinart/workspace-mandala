import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isWeatherHomeInviteHiddenForDay,
  weatherHomeInviteHideDayValue,
  weatherHomeInviteStorageKey,
} from './weather-home-invite'

describe('weatherHomeInviteStorageKey', () => {
  it('scopes the dismiss key by community', () => {
    assert.equal(weatherHomeInviteStorageKey(42), 'mdl_weather_home_invite_hidden:42')
  })
})

describe('isWeatherHomeInviteHiddenForDay', () => {
  it('hides only when stored day matches the Paris civil day', () => {
    // Afternoon Paris — same civil day as midnight UTC+1 winter offset edge cases.
    const afternoon = new Date('2026-11-08T15:00:00+01:00')
    assert.equal(isWeatherHomeInviteHiddenForDay('2026-11-08', afternoon), true)
    assert.equal(isWeatherHomeInviteHiddenForDay('2026-11-07', afternoon), false)
    assert.equal(isWeatherHomeInviteHiddenForDay(null, afternoon), false)
    assert.equal(isWeatherHomeInviteHiddenForDay('1', afternoon), false)
  })

  it('allows the invite again the next Paris civil day', () => {
    const nextMorning = new Date('2026-11-09T08:00:00+01:00')
    assert.equal(isWeatherHomeInviteHiddenForDay('2026-11-08', nextMorning), false)
  })
})

describe('weatherHomeInviteHideDayValue', () => {
  it('stores the Paris YYYY-MM-DD for the dismiss stamp', () => {
    assert.equal(
      weatherHomeInviteHideDayValue(new Date('2026-11-08T23:30:00+01:00')),
      '2026-11-08'
    )
  })
})
