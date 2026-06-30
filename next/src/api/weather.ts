import { api } from '@/lib/api-client'
import type { WeatherState, WeatherStatus } from '@/lib/weather-status'

export const weatherApi = {
  get: (communityId: number) =>
    api.get(`/api/users/weather?communityId=${communityId}`) as Promise<{
      community_id: number
      weather: WeatherState | null
    }>,
  update: (body: {
    community_id: number
    weather_status: WeatherStatus
    weather_note?: string
  }) =>
    api.post('/api/users/weather', body) as Promise<{
      community_id: number
      weather: WeatherState
    }>,
}
