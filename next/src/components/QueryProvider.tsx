'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { invalidatePlaceEvents } from '@/lib/events-changed'

function EventsChangedBridge({ client }: { client: QueryClient }) {
  useEffect(() => {
    const onEventsChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ communitySlug?: string }>).detail
      const slug = detail?.communitySlug?.trim()
      if (!slug) return
      invalidatePlaceEvents(client, slug)
    }
    window.addEventListener('mandala-events-changed', onEventsChanged)
    return () => window.removeEventListener('mandala-events-changed', onEventsChanged)
  }, [client])
  return null
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  )
  return (
    <QueryClientProvider client={client}>
      <EventsChangedBridge client={client} />
      {children}
    </QueryClientProvider>
  )
}
