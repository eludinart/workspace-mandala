'use client'

import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { RichTextViewer } from '@/components/editor/RichTextViewer'

export function CharterEditor({
  html,
  onChange,
  disabled,
}: {
  html: string
  onChange: (html: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">
        Éditez la charte comme un document : titres, gras, listes, liens, images. L&apos;aperçu
        utilise le même rendu que les membres.
      </p>
      <RichTextEditor
        value={html}
        onChange={onChange}
        disabled={disabled}
        placeholder={`CHARTE DU LIEU

Introduction…

## Communication

Texte de la section…

- Point 1
- Point 2`}
      />
    </div>
  )
}

export function CharterPreview({
  html,
  emptyLabel = 'Charte non publiée.',
}: {
  html: string
  emptyLabel?: string
}) {
  return <RichTextViewer html={html} emptyLabel={emptyLabel} />
}
