'use client'

import { DEFAULT_AVATAR_EMOJI, isAvatarImageUrl } from '@/lib/user-avatar'

const SIZE_CLASS = {
  xs: { box: 'w-7 h-7', text: 'text-base', img: 'w-7 h-7' },
  sm: { box: 'w-8 h-8', text: 'text-lg', img: 'w-8 h-8' },
  md: { box: 'w-12 h-12', text: 'text-2xl', img: 'w-12 h-12' },
  lg: { box: 'w-16 h-16', text: 'text-3xl', img: 'w-16 h-16' },
  xl: { box: 'w-20 h-20', text: 'text-5xl', img: 'w-20 h-20' },
} as const

export type UserAvatarSize = keyof typeof SIZE_CLASS

export function UserAvatar({
  avatar,
  avatarEmoji,
  size = 'md',
  className = '',
  alt = '',
}: {
  avatar?: string | null
  avatarEmoji?: string | null
  size?: UserAvatarSize
  className?: string
  alt?: string
}) {
  const s = SIZE_CLASS[size]
  const emoji = (avatarEmoji && String(avatarEmoji).trim()) || DEFAULT_AVATAR_EMOJI

  if (isAvatarImageUrl(avatar)) {
    return (
      <img
        src={avatar!}
        alt={alt}
        className={`${s.img} rounded-full object-cover border border-slate-700 shrink-0 ${className}`}
      />
    )
  }

  return (
    <span
      className={`${s.box} shrink-0 inline-flex items-center justify-center rounded-full bg-slate-800/80 border border-slate-700 ${s.text} ${className}`}
      aria-hidden={!alt}
      title={alt || undefined}
    >
      {emoji}
    </span>
  )
}
