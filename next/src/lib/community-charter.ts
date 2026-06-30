export type CharterBlock =
  | { id: string; type: 'heading'; level: 1 | 2; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'image'; src: string; caption?: string }

export const MAX_CHARTER_BLOCKS = 80
export const MAX_CHARTER_IMAGE_BYTES = 200_000
export const MAX_CHARTER_JSON_BYTES = 600_000

export function newCharterBlockId(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function emptyCharterBlock(type: CharterBlock['type']): CharterBlock {
  const id = newCharterBlockId()
  switch (type) {
    case 'heading':
      return { id, type: 'heading', level: 2, text: '' }
    case 'paragraph':
      return { id, type: 'paragraph', text: '' }
    case 'list':
      return { id, type: 'list', items: [''] }
    case 'image':
      return { id, type: 'image', src: '', caption: '' }
  }
}

function parseImageSrc(src: unknown): string {
  if (typeof src !== 'string' || !src) return ''
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/i.test(src)) {
    throw new Error('Image de charte : format non supporté')
  }
  const raw = Buffer.from(src.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  if (raw.length > MAX_CHARTER_IMAGE_BYTES) {
    throw new Error('Image de charte trop volumineuse (max ~200 Ko)')
  }
  return src
}

export function parseCharterBlocks(raw: unknown): CharterBlock[] {
  if (raw == null || raw === '') return []
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error('Charte invalide')
    }
  }
  if (!Array.isArray(data)) throw new Error('Charte invalide')
  if (data.length > MAX_CHARTER_BLOCKS) {
    throw new Error(`Charte trop longue (max ${MAX_CHARTER_BLOCKS} blocs)`)
  }

  const blocks: CharterBlock[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = String(o.id ?? newCharterBlockId())
    const type = String(o.type ?? '')
    if (type === 'heading') {
      const level = o.level === 1 ? 1 : 2
      blocks.push({ id, type: 'heading', level, text: String(o.text ?? '').slice(0, 200) })
    } else if (type === 'paragraph') {
      blocks.push({ id, type: 'paragraph', text: String(o.text ?? '').slice(0, 4000) })
    } else if (type === 'list') {
      const items = Array.isArray(o.items)
        ? o.items.map((x) => String(x ?? '').slice(0, 500)).filter(Boolean).slice(0, 30)
        : []
      blocks.push({ id, type: 'list', items: items.length ? items : [''] })
    } else if (type === 'image') {
      const src = parseImageSrc(o.src)
      if (src) {
        blocks.push({
          id,
          type: 'image',
          src,
          caption: o.caption != null ? String(o.caption).slice(0, 300) : '',
        })
      }
    }
  }
  return blocks
}

export function serializeCharterBlocks(blocks: CharterBlock[]): string {
  const json = JSON.stringify(blocks)
  if (json.length > MAX_CHARTER_JSON_BYTES) {
    throw new Error('Charte trop volumineuse — réduisez le texte ou les images')
  }
  return json
}

export function charterRequiresAcceptance(blocks: CharterBlock[]): boolean {
  return blocks.length > 0
}
