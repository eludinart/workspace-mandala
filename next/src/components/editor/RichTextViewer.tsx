'use client'

import { sanitizeRichHtml } from '@/lib/sanitize-rich-html'

export function RichTextViewer({
  html,
  className = '',
  emptyLabel = 'Aucun contenu.',
}: {
  html: string
  className?: string
  emptyLabel?: string
}) {
  const clean = sanitizeRichHtml(html)
  if (!clean) {
    return <p className={`text-sm text-slate-500 ${className}`.trim()}>{emptyLabel}</p>
  }
  return (
    <div
      className={`m-rich-text m-rich-text-viewer text-sm text-slate-200 ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
