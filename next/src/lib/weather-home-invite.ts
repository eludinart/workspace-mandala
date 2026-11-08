import { weatherCalendarDay } from './weather-status'

/** localStorage — « Plus tard » jusqu’à demain (jour civil Paris), pas seulement la session. */
export const WEATHER_HOME_INVITE_HIDE_PREFIX = 'mdl_weather_home_invite_hidden'

export function weatherHomeInviteStorageKey(communityId: number): string {
  return `${WEATHER_HOME_INVITE_HIDE_PREFIX}:${communityId}`
}

/** Vrai si le stamp stocké est le jour civil Paris courant. */
export function isWeatherHomeInviteHiddenForDay(
  storedDay: string | null | undefined,
  now = new Date()
): boolean {
  if (!storedDay) return false
  return storedDay === weatherCalendarDay(now)
}

export function weatherHomeInviteHideDayValue(now = new Date()): string {
  return weatherCalendarDay(now)
}
