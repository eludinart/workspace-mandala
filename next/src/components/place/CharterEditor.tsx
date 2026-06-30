'use client'

import type { CharterBlock } from '@/lib/community-charter'
import { emptyCharterBlock } from '@/lib/community-charter'
import { compressAvatarImage } from '@/lib/compress-avatar-image'

function moveBlock(blocks: CharterBlock[], index: number, delta: number): CharterBlock[] {
  const next = [...blocks]
  const target = index + delta
  if (target < 0 || target >= next.length) return blocks
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export function CharterEditor({
  blocks,
  onChange,
  disabled,
}: {
  blocks: CharterBlock[]
  onChange: (blocks: CharterBlock[]) => void
  disabled?: boolean
}) {
  const update = (index: number, block: CharterBlock) => {
    const next = [...blocks]
    next[index] = block
    onChange(next)
  }

  const remove = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index))
  }

  const add = (type: CharterBlock['type']) => {
    onChange([...blocks, emptyCharterBlock(type)])
  }

  return (
    <div className="space-y-4">
      {blocks.length === 0 && (
        <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-700 p-4">
          Aucun contenu pour l&apos;instant. Ajoutez des titres, paragraphes, listes ou images pour
          composer la charte du lieu.
        </p>
      )}

      {blocks.map((block, index) => (
        <div
          key={block.id}
          className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              {block.type === 'heading'
                ? 'Titre'
                : block.type === 'paragraph'
                  ? 'Paragraphe'
                  : block.type === 'list'
                    ? 'Liste'
                    : 'Image'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={disabled || index === 0}
                onClick={() => onChange(moveBlock(blocks, index, -1))}
                className="px-2 py-1 text-xs rounded border border-slate-700 disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={disabled || index === blocks.length - 1}
                onClick={() => onChange(moveBlock(blocks, index, 1))}
                className="px-2 py-1 text-xs rounded border border-slate-700 disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(index)}
                className="px-2 py-1 text-xs rounded border border-red-900/50 text-red-400"
              >
                Suppr.
              </button>
            </div>
          </div>

          {block.type === 'heading' && (
            <div className="space-y-2">
              <select
                value={block.level}
                disabled={disabled}
                onChange={(e) =>
                  update(index, { ...block, level: parseInt(e.target.value, 10) as 1 | 2 })
                }
                className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
              >
                <option value={1}>Titre principal</option>
                <option value={2}>Sous-titre</option>
              </select>
              <input
                value={block.text}
                disabled={disabled}
                onChange={(e) => update(index, { ...block, text: e.target.value })}
                placeholder="Titre de section"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              />
            </div>
          )}

          {block.type === 'paragraph' && (
            <textarea
              value={block.text}
              disabled={disabled}
              onChange={(e) => update(index, { ...block, text: e.target.value })}
              rows={4}
              placeholder="Texte de la charte…"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm resize-y"
            />
          )}

          {block.type === 'list' && (
            <div className="space-y-2">
              {block.items.map((item, itemIdx) => (
                <div key={`${block.id}-${itemIdx}`} className="flex gap-2">
                  <input
                    value={item}
                    disabled={disabled}
                    onChange={(e) => {
                      const items = [...block.items]
                      items[itemIdx] = e.target.value
                      update(index, { ...block, items })
                    }}
                    placeholder={`Point ${itemIdx + 1}`}
                    className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={disabled || block.items.length <= 1}
                    onClick={() => {
                      const items = block.items.filter((_, i) => i !== itemIdx)
                      update(index, { ...block, items: items.length ? items : [''] })
                    }}
                    className="px-2 text-xs text-slate-500"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={disabled}
                onClick={() => update(index, { ...block, items: [...block.items, ''] })}
                className="text-xs text-sky-400"
              >
                + Ajouter un point
              </button>
            </div>
          )}

          {block.type === 'image' && (
            <div className="space-y-2">
              {block.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={block.src} alt="" className="max-h-48 rounded-lg border border-slate-700" />
              ) : (
                <p className="text-xs text-slate-500">Aucune image</p>
              )}
              <input
                type="file"
                accept="image/*"
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
                  update(index, { ...block, src: dataUrl })
                }}
                className="text-xs text-slate-400"
              />
              <input
                value={block.caption ?? ''}
                disabled={disabled}
                onChange={(e) => update(index, { ...block, caption: e.target.value })}
                placeholder="Légende (optionnelle)"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {(['heading', 'paragraph', 'list', 'image'] as const).map((type) => (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => add(type)}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-900"
          >
            {type === 'heading'
              ? '+ Titre'
              : type === 'paragraph'
                ? '+ Paragraphe'
                : type === 'list'
                  ? '+ Liste'
                  : '+ Image'}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CharterPreview({ blocks }: { blocks: CharterBlock[] }) {
  if (blocks.length === 0) {
    return <p className="text-sm text-slate-500">Charte non publiée.</p>
  }
  return (
    <article className="space-y-4 text-sm text-slate-200">
      {blocks.map((block) => {
        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h2' : 'h3'
          return (
            <Tag
              key={block.id}
              className={block.level === 1 ? 'text-xl font-bold text-white' : 'text-lg font-semibold'}
            >
              {block.text}
            </Tag>
          )
        }
        if (block.type === 'paragraph') {
          return (
            <p key={block.id} className="whitespace-pre-wrap leading-relaxed">
              {block.text}
            </p>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={block.id} className="list-disc pl-5 space-y-1">
              {block.items.filter(Boolean).map((item, i) => (
                <li key={`${block.id}-${i}`}>{item}</li>
              ))}
            </ul>
          )
        }
        return (
          <figure key={block.id} className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={block.src} alt={block.caption ?? ''} className="max-w-full rounded-xl border border-slate-800" />
            {block.caption && <figcaption className="text-xs text-slate-500">{block.caption}</figcaption>}
          </figure>
        )
      })}
    </article>
  )
}
