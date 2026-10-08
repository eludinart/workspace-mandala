'use client'

import { useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { OPEN_SKILL_USER_KEY, SkillsDirectory } from '@/components/skills/SkillsDirectory'
import { useCommunity } from '@/contexts/CommunityContext'

export function SkillsPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { active } = useCommunity()
  const [openUserId, setOpenUserId] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = sessionStorage.getItem(OPEN_SKILL_USER_KEY)
    if (!raw) return
    sessionStorage.removeItem(OPEN_SKILL_USER_KEY)
    const id = parseInt(raw, 10)
    if (id) setOpenUserId(id)
  }, [])

  return (
    <div className="w-full">
      <SkillsDirectory
        communitySlug={active?.slug}
        communityName={active?.name}
        initialUserId={openUserId}
        onOpenMessages={
          onNavigate
            ? (userId, communitySlug) =>
                onNavigate('messages', { messagesUserId: userId, communitySlug })
            : undefined
        }
        onOpenConversation={
          onNavigate
            ? (channelId) => onNavigate('messages', { messagesChannelId: String(channelId) })
            : undefined
        }
        onOpenAlerts={onNavigate ? () => onNavigate('notifications') : undefined}
        onEditProfile={onNavigate ? () => onNavigate('account') : undefined}
      />
    </div>
  )
}
