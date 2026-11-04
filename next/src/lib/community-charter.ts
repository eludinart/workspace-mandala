import { richHtmlHasContent, sanitizeRichHtml } from './sanitize-rich-html'

export type CharterBlock =
  | { id: string; type: 'heading'; level: 1 | 2; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'image'; src: string; caption?: string }

/** Document charte v2 — HTML sanitizé (éditeur riche). */
export type CharterHtmlDocument = {
  format: 'html'
  html: string
}

export const MAX_CHARTER_BLOCKS = 200
export const MAX_CHARTER_IMAGE_BYTES = 200_000
export const MAX_CHARTER_JSON_BYTES = 1_500_000
export const MAX_CHARTER_HEADING = 500
export const MAX_CHARTER_PARAGRAPH = 100_000
export const MAX_CHARTER_LIST_ITEM = 2_000
export const MAX_CHARTER_LIST_ITEMS = 80
export const MAX_CHARTER_CAPTION = 500

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlAttr(text: string): string {
  return escapeHtmlText(text).replace(/'/g, '&#39;')
}

/** Convertit d’anciens blocs charte en HTML pour l’éditeur riche. */
export function charterBlocksToHtml(blocks: CharterBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'heading') {
      const tag = block.level === 1 ? 'h1' : 'h2'
      const text = escapeHtmlText(stripWrappingMdEmphasis(block.text))
      if (text) parts.push(`<${tag}>${text}</${tag}>`)
    } else if (block.type === 'paragraph') {
      const text = escapeHtmlText(stripWrappingMdEmphasis(block.text)).replace(/\n/g, '<br>')
      if (text) parts.push(`<p>${text}</p>`)
    } else if (block.type === 'list') {
      const items = block.items
        .map((item) => stripWrappingMdEmphasis(item).trim())
        .filter(Boolean)
        .map((item) => `<li>${escapeHtmlText(item)}</li>`)
      if (items.length) parts.push(`<ul>${items.join('')}</ul>`)
    } else if (block.type === 'image' && block.src) {
      const alt = escapeHtmlAttr(block.caption ?? '')
      parts.push(`<img src="${escapeHtmlAttr(block.src)}" alt="${alt}">`)
    }
  }
  return sanitizeRichHtml(parts.join(''))
}

/**
 * Normalise toute valeur stockée / API en HTML sanitizé.
 * Accepte : document `{format:'html'}`, tableau de blocs legacy, HTML brut, JSON string.
 */
export function parseCharterToHtml(raw: unknown): string {
  if (raw == null || raw === '') return ''

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('<')) return sanitizeRichHtml(trimmed)
    try {
      return parseCharterToHtml(JSON.parse(trimmed))
    } catch {
      return sanitizeRichHtml(
        `<p>${escapeHtmlText(trimmed).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
      )
    }
  }

  if (Array.isArray(raw)) {
    return charterBlocksToHtml(parseCharterBlocks(raw))
  }

  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (o.format === 'html' || typeof o.html === 'string') {
      return sanitizeRichHtml(String(o.html ?? ''))
    }
  }

  throw new Error('Charte invalide')
}

/** Sérialise le HTML pour stockage DB (`charter` LONGTEXT). */
export function serializeCharterHtml(html: string): string {
  const clean = sanitizeRichHtml(html)
  if (!richHtmlHasContent(clean)) return ''
  const doc: CharterHtmlDocument = { format: 'html', html: clean }
  const json = JSON.stringify(doc)
  if (json.length > MAX_CHARTER_JSON_BYTES) {
    throw new Error('Charte trop volumineuse — réduisez le texte ou les images')
  }
  return json
}

export function charterHtmlRequiresAcceptance(html: string): boolean {
  return richHtmlHasContent(html)
}

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
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

/** Retire un wrapping Markdown gras (`**…**` / `__…__`) sur tout le texte. */
export function stripWrappingMdEmphasis(text: string): string {
  let t = text.trim()
  for (let i = 0; i < 3; i += 1) {
    const bold = t.match(/^\*\*([\s\S]+)\*\*$/) ?? t.match(/^__([\s\S]+)__$/)
    if (!bold) break
    t = bold[1].trim()
  }
  return t
}

function blockPlainText(block: CharterBlock): string {
  switch (block.type) {
    case 'heading':
      return stripWrappingMdEmphasis(block.text)
    case 'paragraph':
      return stripWrappingMdEmphasis(block.text)
    case 'list':
      return block.items.map((item) => stripWrappingMdEmphasis(item)).filter(Boolean).join('\n')
    case 'image':
      return stripWrappingMdEmphasis(block.caption ?? '')
    default: {
      const _exhaustive: never = block
      return _exhaustive
    }
  }
}

/** Change le type d’un bloc en conservant le contenu textuel autant que possible. */
export function convertCharterBlock(
  block: CharterBlock,
  nextType: CharterBlock['type'],
): CharterBlock {
  if (block.type === nextType) return block
  const id = block.id
  const text = blockPlainText(block)

  switch (nextType) {
    case 'heading':
      return {
        id,
        type: 'heading',
        level: block.type === 'heading' ? block.level : 2,
        text: text.slice(0, MAX_CHARTER_HEADING),
      }
    case 'paragraph':
      return {
        id,
        type: 'paragraph',
        text: text.slice(0, MAX_CHARTER_PARAGRAPH),
      }
    case 'list': {
      const items = text
        .split('\n')
        .map((line) => line.replace(/^[-*+]\s+/, '').trim())
        .filter(Boolean)
        .slice(0, MAX_CHARTER_LIST_ITEMS)
        .map((item) => item.slice(0, MAX_CHARTER_LIST_ITEM))
      return { id, type: 'list', items: items.length ? items : [''] }
    }
    case 'image':
      return {
        id,
        type: 'image',
        src: block.type === 'image' ? block.src : '',
        caption: text.slice(0, MAX_CHARTER_CAPTION),
      }
    default: {
      const _exhaustive: never = nextType
      return _exhaustive
    }
  }
}

function dataUrlByteLength(dataUrl: string): number {
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const padding = (b64.match(/=+$/)?.[0].length ?? 0)
  return Math.floor((b64.length * 3) / 4) - padding
}

function parseImageSrc(src: unknown): string {
  if (typeof src !== 'string' || !src) return ''
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/i.test(src)) {
    throw new Error('Image de charte : format non supporté')
  }
  if (dataUrlByteLength(src) > MAX_CHARTER_IMAGE_BYTES) {
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
      blocks.push({
        id,
        type: 'heading',
        level,
        text: stripWrappingMdEmphasis(String(o.text ?? '')).slice(0, MAX_CHARTER_HEADING),
      })
    } else if (type === 'paragraph') {
      blocks.push({
        id,
        type: 'paragraph',
        text: stripWrappingMdEmphasis(String(o.text ?? '')).slice(0, MAX_CHARTER_PARAGRAPH),
      })
    } else if (type === 'list') {
      const items = Array.isArray(o.items)
        ? o.items
            .map((x) => stripWrappingMdEmphasis(String(x ?? '')).slice(0, MAX_CHARTER_LIST_ITEM))
            .filter(Boolean)
            .slice(0, MAX_CHARTER_LIST_ITEMS)
        : []
      blocks.push({ id, type: 'list', items: items.length ? items : [''] })
    } else if (type === 'image') {
      const src = parseImageSrc(o.src)
      if (src) {
        blocks.push({
          id,
          type: 'image',
          src,
          caption:
            o.caption != null
              ? stripWrappingMdEmphasis(String(o.caption)).slice(0, MAX_CHARTER_CAPTION)
              : '',
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

/** @deprecated Prefer `charterHtmlRequiresAcceptance` — conservé pour les appels blocs legacy. */
export function charterRequiresAcceptance(htmlOrBlocks: string | CharterBlock[]): boolean {
  if (Array.isArray(htmlOrBlocks)) return htmlOrBlocks.length > 0
  return charterHtmlRequiresAcceptance(htmlOrBlocks)
}

/** Convertit les blocs charte en Markdown éditable. */
export function charterBlocksToMarkdown(blocks: CharterBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'heading') {
      const prefix = block.level === 1 ? '# ' : '## '
      parts.push(`${prefix}${block.text.trim()}`)
    } else if (block.type === 'paragraph') {
      parts.push(block.text.trim())
    } else if (block.type === 'list') {
      const lines = block.items.map((item) => `- ${item.trim()}`).filter((l) => l !== '- ')
      if (lines.length) parts.push(lines.join('\n'))
    } else if (block.type === 'image' && block.src) {
      const alt = (block.caption ?? '').replace(/[\[\]]/g, '')
      parts.push(`![${alt}](${block.src})`)
    }
  }
  return parts.join('\n\n').trim()
}

/** Titre implicite : MAJUSCULES courtes, ou ligne courte démarrant par un emoji. */
function looksLikeImplicitHeading(line: string): 1 | 2 | null {
  const t = line.trim()
  if (t.length < 2 || t.length > 90) return null
  if (/[.!?…,:;]$/.test(t)) return null
  if (/^#{1,6}\s/.test(t) || /^[-*+]\s/.test(t)) return null
  const letters = t.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '')
  if (
    letters.length >= 3 &&
    letters === letters.toUpperCase() &&
    t.length <= 40
  ) {
    return 1
  }
  // Emoji / pictogramme en tête, ou caractère de remplacement (copier-coller cassé)
  if (
    t.startsWith('\uFFFD') ||
    /^\p{Extended_Pictographic}/u.test(t) ||
    /^[\u2600-\u27BF\uFE0F]/.test(t)
  ) {
    return 2
  }
  return null
}

/**
 * Parse Markdown simple (# / ##, listes - / *, images) + titres implicites
 * (MAJUSCULES, lignes courtes avec emoji) pour coller un texte brut de charte.
 */
export function markdownToCharterBlocks(md: string): CharterBlock[] {
  const text = md.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const blocks: CharterBlock[] = []
  const lines = text.split('\n')
  let i = 0

  const pushParagraph = (buf: string[]) => {
    const joined = stripWrappingMdEmphasis(buf.join('\n').trim())
    if (!joined) return
    // Une seule ligne courte type titre → heading
    if (buf.length === 1) {
      const level = looksLikeImplicitHeading(joined)
      if (level) {
        blocks.push({
          id: newCharterBlockId(),
          type: 'heading',
          level,
          text: joined.slice(0, MAX_CHARTER_HEADING),
        })
        return
      }
    }
    blocks.push({
      id: newCharterBlockId(),
      type: 'paragraph',
      text: joined.slice(0, MAX_CHARTER_PARAGRAPH),
    })
  }

  const pushList = (items: string[]) => {
    const cleaned = items
      .map((x) => stripWrappingMdEmphasis(x).slice(0, MAX_CHARTER_LIST_ITEM))
      .filter(Boolean)
      .slice(0, MAX_CHARTER_LIST_ITEMS)
    if (!cleaned.length) return
    blocks.push({ id: newCharterBlockId(), type: 'list', items: cleaned })
  }

  while (i < lines.length && blocks.length < MAX_CHARTER_BLOCKS) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length === 1 ? 1 : 2
      blocks.push({
        id: newCharterBlockId(),
        type: 'heading',
        level,
        text: stripWrappingMdEmphasis(heading[2]).slice(0, MAX_CHARTER_HEADING),
      })
      i += 1
      continue
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\((data:image\/[^)]+)\)$/i)
    if (image) {
      try {
        const src = parseImageSrc(image[2])
        if (src) {
          blocks.push({
            id: newCharterBlockId(),
            type: 'image',
            src,
            caption: image[1].slice(0, MAX_CHARTER_CAPTION),
          })
        }
      } catch {
        // Image invalide : ignorer
      }
      i += 1
      continue
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length) {
        const t = lines[i].trim()
        if (!t) break
        const m = t.match(/^[-*+]\s+(.+)$/)
        if (!m) break
        items.push(m[1].trim())
        i += 1
      }
      pushList(items)
      continue
    }

    // Titre implicite isolé (ligne courte puis suite du texte)
    const implicitLine = stripWrappingMdEmphasis(trimmed)
    const implicit = looksLikeImplicitHeading(implicitLine)
    if (implicit) {
      const nextNonEmpty = lines.slice(i + 1).find((l) => l.trim())
      if (nextNonEmpty != null) {
        blocks.push({
          id: newCharterBlockId(),
          type: 'heading',
          level: implicit,
          text: implicitLine.slice(0, MAX_CHARTER_HEADING),
        })
        i += 1
        continue
      }
    }

    const para: string[] = []
    while (i < lines.length) {
      const t = lines[i].trim()
      if (!t) break
      if (/^#{1,6}\s+/.test(t)) break
      if (/^[-*+]\s+/.test(t)) break
      if (/^!\[[^\]]*\]\(data:image\//i.test(t)) break
      // Nouvelle section (emoji / MAJUSCULES) au milieu d’un paragraphe
      if (para.length > 0 && looksLikeImplicitHeading(t)) break
      para.push(lines[i].replace(/\s+$/, ''))
      i += 1
    }
    pushParagraph(para)
  }

  return blocks
}
