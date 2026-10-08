'use client'

import type { MandalaNavigate } from '@/components/MandalaApp'
import { SkillsDirectory } from '@/components/skills/SkillsDirectory'

export function DirectoryPage({ onNavigate }: { onNavigate: MandalaNavigate }) {
  return (
    <div className="w-full">
      <SkillsDirectory
        peopleDirectory
        onOpenMessages={(userId, communitySlug) =>
          onNavigate('messages', { messagesUserId: userId, communitySlug })
        }
        onOpenConversation={(channelId) =>
          onNavigate('messages', { messagesChannelId: String(channelId) })
        }
        onOpenAlerts={() => onNavigate('notifications')}
        onEditProfile={() => onNavigate('account')}
      />
    </div>
  )
}
