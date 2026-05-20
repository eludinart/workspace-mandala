'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore, type ChannelMessage } from '@/store/useSocialStore'
import { TemperatureIndicator } from './TemperatureIndicator'
import { UserAvatar } from '@/components/UserAvatar'

export function DialogueStream({
  channelId,
  otherPseudo,
  otherAvatar,
  otherAvatarEmoji,
  otherIsOnline = false,
}: {
  channelId: number
  otherPseudo?: string
  otherAvatar?: string | null
  otherAvatarEmoji?: string
  otherIsOnline?: boolean
}) {
  const { user } = useAuth()
  const meId = user?.id ? Number(user.id) : null
  const { messagesByChannel, temperatureByChannel, loadChannelMessages, sendMessage, markChannelRead } =
    useSocialStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingMessages, setPendingMessages] = useState<ChannelMessage[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  const messages = messagesByChannel[String(channelId)] || []
  const visibleMessages = [...messages, ...pendingMessages]
  const temperature = temperatureByChannel[String(channelId)] || 'calm'

  useEffect(() => {
    if (!channelId) return
    let inFlight = false
    const refresh = async () => {
      if (inFlight) return
      inFlight = true
      try {
        await loadChannelMessages(channelId)
        markChannelRead?.(channelId)
      } finally {
        inFlight = false
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 15000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [channelId, loadChannelMessages, markChannelRead])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [channelId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      if (nearBottom) el.scrollTop = el.scrollHeight
    })
  }, [visibleMessages.length])

  const handleSendText = async () => {
    const text = input.trim()
    if (!text || sending) return
    const tempId = `tmp-${Date.now()}`
    setPendingMessages((prev) => [
      ...prev,
      { id: tempId as unknown as number, senderId: meId ?? undefined, body: text, createdAt: new Date().toISOString() },
    ])
    setInput('')
    setSending(true)
    try {
      await sendMessage(channelId, { body: text })
    } finally {
      setPendingMessages((prev) => prev.filter((m) => String(m.id) !== tempId))
      setSending(false)
    }
  }

  return (
    <div className="flex-1 min-h-[min(70vh,600px)] flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-slate-800">
        <TemperatureIndicator temperature={temperature} className="shrink-0" />
        <UserAvatar
          avatar={otherAvatar}
          avatarEmoji={otherAvatarEmoji}
          size="sm"
          alt={otherPseudo}
        />
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${otherIsOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}
        />
        <span className="text-sm font-medium truncate">{otherPseudo || 'Dialogue'}</span>
        <span className="text-[11px] text-slate-500 shrink-0">{otherIsOnline ? 'En ligne' : 'Hors ligne'}</span>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 min-h-0">
        {visibleMessages.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">Envoyez le premier message.</p>
        )}
        {visibleMessages.map((msg, index) => {
          const isMe = msg.senderId === meId
          const itemKey = String(msg.id ?? msg.messageId ?? index)
          const body = msg.body || (msg.cardSlug ? `🃏 ${msg.cardSlug}` : '')
          return (
            <div key={itemKey} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  isMe
                    ? 'bg-violet-600/30 text-violet-100'
                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}
              >
                {body}
              </div>
            </div>
          )
        })}
      </div>

      <div className="shrink-0 p-3 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSendText()}
          placeholder="Écrire un message…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder-slate-500 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleSendText()}
          disabled={!input.trim() || sending}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
        >
          {sending ? '…' : 'Envoyer'}
        </button>
      </div>
    </div>
  )
}


