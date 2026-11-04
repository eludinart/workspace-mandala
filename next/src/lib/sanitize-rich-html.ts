import sanitizeHtml from 'sanitize-html'

/** Balises autorisées pour l’éditeur riche Mandala (charte, puis autres contenus). */
export const RICH_HTML_ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'a',
  'img',
  'blockquote',
] as const

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...RICH_HTML_ALLOWED_TAGS],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    b: 'strong',
    i: 'em',
  },
}

export function sanitizeRichHtml(html: string): string {
  if (!html || !html.trim()) return ''
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim()
}

export function richHtmlHasContent(html: string): boolean {
  const clean = sanitizeRichHtml(html)
  if (!clean) return false
  if (/<img\b/i.test(clean)) return true
  const text = clean.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim()
  return text.length > 0
}
