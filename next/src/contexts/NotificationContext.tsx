'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { notificationsApi } from '@/api/notifications'

export type NotificationItem = {
  id: string
  type?: string
  title?: string
  body?: string | null
  action_url?: string | null
  action_label?: string | null
  read_at?: string | null
  created_at?: string | null
  priority?: string
  delivery_id?: string
  source_type?: string | null
  source_id?: string | null
  channel_id?: string | null
}

type NotificationContextValue = {
  unreadCount: number
  items: NotificationItem[]
  loading: boolean
  fetchList: (params?: Record<string, unknown>) => Promise<unknown>
  fetchUnread: () => Promise<void>
  markRead: (ids: string[]) => Promise<void>
  markAllRead: () => Promise<void>
  deleteRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const POLL_INTERVAL_MS = 30_000

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const listLoadedRef = useRef(false)

  const userId =
    user && (user as { id?: string | number }).id != null
      ? String((user as { id: string | number }).id)
      : null

  const fetchUnread = useCallback(async () => {
    if (!userId) return
    try {
      const data = (await notificationsApi.unreadCount()) as { unread?: number }
      setUnreadCount(data.unread ?? 0)
    } catch {
      /* non bloquant */
    }
  }, [userId])

  const fetchList = useCallback(
    async (params: Record<string, unknown> = {}) => {
      if (!userId) return null
      setLoading(true)
      try {
        const data = (await notificationsApi.list(params)) as {
          items?: NotificationItem[]
          unread?: number
        }
        setItems(data.items ?? [])
        setUnreadCount(data.unread ?? 0)
        listLoadedRef.current = true
        return data
      } catch {
        return null
      } finally {
        setLoading(false)
      }
    },
    [userId]
  )

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      try {
        await notificationsApi.markRead(ids)
        setItems((prev) =>
          prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
        )
        await fetchUnread()
      } catch {
        /* non bloquant */
      }
    },
    [fetchUnread]
  )

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
      await fetchUnread()
    } catch {
      /* non bloquant */
    }
  }, [fetchUnread])

  const deleteRead = useCallback(async () => {
    try {
      await notificationsApi.deleteRead()
      setItems((prev) => prev.filter((n) => !n.read_at))
      void fetchUnread()
    } catch {
      /* non bloquant */
    }
  }, [fetchUnread])

  const refreshFromPush = useCallback(() => {
    void fetchUnread()
    if (listLoadedRef.current) void fetchList({ per_page: 15 })
  }, [fetchUnread, fetchList])

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      setItems([])
      listLoadedRef.current = false
      return
    }
    void fetchUnread()
    pollRef.current = setInterval(() => void fetchUnread(), POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [userId, fetchUnread])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchUnread()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchUnread])

  // Push reçu (app ouverte) ou clic sur notification OS → mettre à jour la cloche
  useEffect(() => {
    if (!userId || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type
      if (type === 'MDL_PUSH_RECEIVED' || type === 'MDL_PUSH_NAV') {
        refreshFromPush()
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [userId, refreshFromPush])

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        items,
        loading,
        fetchList,
        fetchUnread,
        markRead,
        markAllRead,
        deleteRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
