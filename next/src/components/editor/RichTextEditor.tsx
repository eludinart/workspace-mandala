'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { compressAvatarImage } from '@/lib/compress-avatar-image'
import { sanitizeRichHtml } from '@/lib/sanitize-rich-html'

type RichTextFeatures = {
  headings?: boolean
  lists?: boolean
  boldItalic?: boolean
  link?: boolean
  image?: boolean
}

const DEFAULT_FEATURES: Required<RichTextFeatures> = {
  headings: true,
  lists: true,
  boldItalic: true,
  link: true,
  image: true,
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs border transition-colors disabled:opacity-40 ${
        active
          ? 'border-violet-500/60 bg-violet-950/40 text-violet-100'
          : 'border-slate-700 text-slate-300 hover:bg-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  disabled,
  placeholder = 'Écrivez ici…',
  features,
  minHeightClass = 'min-h-[14rem]',
  maxHeightClass = 'max-h-[min(70dvh,36rem)]',
}: {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  features?: RichTextFeatures
  minHeightClass?: string
  /** Hauteur max du bloc éditeur : la barre d’outils reste fixe, le texte défile dessous. */
  maxHeightClass?: string
}) {
  const f = { ...DEFAULT_FEATURES, ...features }
  const lastEmitted = useRef(value)
  const fileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: f.headings ? { levels: [1, 2] } : false,
        bold: f.boldItalic ? undefined : false,
        italic: f.boldItalic ? undefined : false,
        bulletList: f.lists ? undefined : false,
        orderedList: f.lists ? undefined : false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
      }),
      ...(f.link
        ? [
            Link.configure({
              openOnClick: false,
              autolink: true,
              HTMLAttributes: { rel: 'noopener noreferrer' },
            }),
          ]
        : []),
      ...(f.image ? [Image.configure({ allowBase64: true })] : []),
      Placeholder.configure({ placeholder }),
    ],
    content: sanitizeRichHtml(value) || '',
    onUpdate: ({ editor: ed }) => {
      const html = sanitizeRichHtml(ed.getHTML())
      lastEmitted.current = html
      onChange(html)
    },
    editorProps: {
      attributes: {
        class:
          'm-rich-text m-rich-text-editor outline-none px-3 py-3 text-sm leading-relaxed text-slate-100 min-h-full',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor) return
    const incoming = sanitizeRichHtml(value)
    if (incoming === lastEmitted.current) return
    if (incoming === sanitizeRichHtml(editor.getHTML())) return
    lastEmitted.current = incoming
    editor.commands.setContent(incoming || '', { emitUpdate: false })
  }, [editor, value])

  if (!editor) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-8 text-sm text-slate-500">
        Chargement de l&apos;éditeur…
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border border-slate-700 bg-slate-950/50 flex flex-col overflow-hidden ${minHeightClass} ${maxHeightClass}`}
    >
      <div className="shrink-0 sticky top-0 z-10 flex flex-wrap gap-1 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-2 py-1.5">
        {f.headings && (
          <>
            <ToolbarButton
              title="Titre principal"
              active={editor.isActive('heading', { level: 1 })}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              H1
            </ToolbarButton>
            <ToolbarButton
              title="Sous-titre"
              active={editor.isActive('heading', { level: 2 })}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              title="Paragraphe"
              active={editor.isActive('paragraph')}
              disabled={disabled}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              ¶
            </ToolbarButton>
          </>
        )}
        {f.boldItalic && (
          <>
            <ToolbarButton
              title="Gras"
              active={editor.isActive('bold')}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <strong>G</strong>
            </ToolbarButton>
            <ToolbarButton
              title="Italique"
              active={editor.isActive('italic')}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <em>I</em>
            </ToolbarButton>
          </>
        )}
        {f.lists && (
          <>
            <ToolbarButton
              title="Liste à puces"
              active={editor.isActive('bulletList')}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              • Liste
            </ToolbarButton>
            <ToolbarButton
              title="Liste numérotée"
              active={editor.isActive('orderedList')}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              1. Liste
            </ToolbarButton>
          </>
        )}
        {f.link && (
          <ToolbarButton
            title="Lien"
            active={editor.isActive('link')}
            disabled={disabled}
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run()
                return
              }
              const prev = editor.getAttributes('link').href as string | undefined
              const url = window.prompt('URL du lien', prev || 'https://')
              if (!url) return
              editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
            }}
          >
            Lien
          </ToolbarButton>
        )}
        {f.image && (
          <>
            <ToolbarButton
              title="Image"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
            >
              Image
            </ToolbarButton>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                const { dataUrl, error } = await compressAvatarImage(file, 180_000)
                if (error || !dataUrl) {
                  alert(error ?? 'Image invalide')
                  return
                }
                editor.chain().focus().setImage({ src: dataUrl }).run()
              }}
            />
          </>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
