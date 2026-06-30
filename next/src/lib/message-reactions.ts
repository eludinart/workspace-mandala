/** Réactions rapides sur les messages (style réseau social). */
export const MESSAGE_REACTION_EMOJIS = [
  '❤️',
  '👍',
  '😂',
  '😮',
  '😢',
  '🙏',
  '🔥',
  '👏',
  '💜',
  '✨',
] as const

export type MessageReactionEmoji = (typeof MESSAGE_REACTION_EMOJIS)[number]

export type MessageReactionSummary = {
  emoji: string
  userIds: number[]
}

export function isAllowedReactionEmoji(emoji: string): boolean {
  return (MESSAGE_REACTION_EMOJIS as readonly string[]).includes(emoji)
}
