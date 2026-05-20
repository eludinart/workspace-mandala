'use client'

import { DEFAULT_AVATAR_EMOJI, isAvatarImageUrl } from '@/lib/user-avatar'

const SIZE_CLASS = {
  xs: { box: 'w-7 h-7', text: 'text-base', img: 'w-7 h-7' },
  sm: { box: 'w-10 h-10', text: 'text-xl', img: 'w-10 h-10' },
  md: { box: 'w-14 h-14', text: 'text-2xl', img: 'w-14 h-14' },
  lg: { box: 'w-20 h-20', text: 'text-4xl', img: 'w-20 h-20' },
  xl: { box: 'w-28 h-28', text: 'text-5xl', img: 'w-28 h-28' },
} as const

export type CommunityAvatarSize = keyof typeof SIZE_CLASS

export function CommunityAvatar({
  avatar,
  logoEmoji,
  accentColor,
  size = 'md',
  className = '',
  alt = '',
}: {
  avatar?: string | null
  logoEmoji?: string | null
  accentColor?: string | null
  size?: CommunityAvatarSize
  className?: string
  alt?: string
}) {
  const s = SIZE_CLASS[size]
  const emoji = (logoEmoji && String(logoEmoji).trim()) || DEFAULT_AVATAR_EMOJI
  const ring = accentColor && accentColor.startsWith('#') ? accentColor : '#7c3aed'

  if (isAvatarImageUrl(avatar)) {
    return (
      <img
        src={avatar!}
        alt={alt}
        className={`${s.img} rounded-xl object-cover border-2 shrink-0 ${className}`}
        style={{ borderColor: `${ring}99` }}
      />
    )
  }

  return (
    <span
      className={`${s.box} shrink-0 inline-flex items-center justify-center rounded-xl border-2 ${s.text} ${className}`}
      style={{
        borderColor: `${ring}99`,
        backgroundColor: `${ring}22`,
      }}
      aria-hidden={!alt}
      title={alt || undefined}
    >
      {emoji}
    </span>
  )
}
