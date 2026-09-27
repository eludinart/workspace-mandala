'use client'

import { useEffect, useMemo, useState } from 'react'
import { resourcesApi, type ResourceDetail, type ResourceDraft } from '@/api/resources'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import {
  formatByteLimit,
  isAllowedFileMime,
  isAllowedImageMime,
  MAX_IMAGE_BYTES,
  MAX_RESOURCE_IMAGES,
  RESOURCE_KINDS,
  maxBytesForMime,
  resourceKindMeta,
  type ResourceKind,
  type ResourceScope,
} from '@/lib/resource-constants'

declare global {
  interface Window {
    __mdlResourcesDirty?: boolean
    __mdlResourcesHost?: 'account' | 'resources'
  }
}

const empty = (kind: ResourceKind): ResourceDraft => ({
  kind,
  title: '',
  summary: '',
  body_text: '',
  scope: 'hidden',
  downloadable: false,
  place_ids: [],
  tags: [],
  file: null,
  cover: null,
  clear_cover: false,
  images: [],
  remove_image_ids: [],
})

export function ResourceComposer({
  host,
  editing,
  onClose,
  onSaved,
}: {
  host: 'account' | 'resources'
  editing?: ResourceDetail | null
  onClose: () => void
  onSaved: () => void
}) {
  const { communities } = useCommunity()
  const [step, setStep] = useState(editing ? 3 : 1)
  const [draft, setDraft] = useState<ResourceDraft>(() =>
    editing
      ? {
          ...empty(editing.kind),
          title: editing.title,
          summary: editing.summary,
          body_text: editing.body_text,
          scope: editing.scope,
          downloadable: editing.downloadable,
          place_ids: editing.places.map((p) => p.id),
          tags: editing.tags,
        }
      : empty('recipe')
  )
  const [tagInput, setTagInput] = useState('')
  const [useFileAsCover, setUseFileAsCover] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = resourceKindMeta(draft.kind)
  const fileLimit = useMemo(() => {
    if (meta.mode !== 'file') return formatByteLimit(MAX_IMAGE_BYTES)
    if (draft.kind === 'video') return '200 Mo'
    if (draft.kind === 'document') return '25 Mo'
    if (draft.kind === 'other') return '200 Mo'
    return '80 Mo'
  }, [draft.kind, meta.mode])

  const dirty = step > 1 || !!draft.title || !!draft.body_text || !!draft.file || draft.images.length > 0

  useEffect(() => {
    window.__mdlResourcesDirty = dirty
    window.__mdlResourcesHost = host
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.__mdlResourcesDirty = false
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [dirty, host])

  function close() {
    if (dirty) {
      const stay = window.confirm('Ce brouillon n’est pas publié. Rester sur la page pour le garder ?')
      if (stay) return
      window.__mdlResourcesDirty = false
    }
    onClose()
  }

  function pickFile(file: File | null) {
    if (!file) return
    if (!isAllowedFileMime(draft.kind, file.type)) {
      setError('Ce format n’est pas accepté pour ce type.')
      return
    }
    const max = maxBytesForMime(file.type)
    if (file.size > max) {
      setError(`Fichier trop lourd (maximum ${formatByteLimit(max)}).`)
      return
    }
    setError(null)
    setDraft((d) => ({ ...d, file }))
  }

  function addImages(list: FileList | null) {
    if (!list) return
    const next = [...draft.images]
    for (const file of Array.from(list)) {
      if (!isAllowedImageMime(file.type) || file.size > MAX_IMAGE_BYTES) {
        setError(`Images : jpeg, png, webp ou gif, ${formatByteLimit(MAX_IMAGE_BYTES)} maximum.`)
        continue
      }
      if (next.length >= MAX_RESOURCE_IMAGES) break
      next.push(file)
    }
    setDraft((d) => ({ ...d, images: next }))
  }

  function addTag() {
    const label = tagInput.trim()
    if (!label) return
    setDraft((d) => (d.tags.includes(label) || d.tags.length >= 12 ? d : { ...d, tags: [...d.tags, label] }))
    setTagInput('')
  }

  async function publish() {
    setBusy(true)
    setError(null)
    try {
      const payload: ResourceDraft = {
        ...draft,
        cover:
          draft.cover ??
          (useFileAsCover && draft.file && draft.file.type.startsWith('image/') ? draft.file : null),
      }
      if (editing) await resourcesApi.update(editing.id, payload)
      else await resourcesApi.create(payload)
      window.__mdlResourcesDirty = false
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Publication impossible')
    } finally {
      setBusy(false)
    }
  }

  const scopeSentence =
    draft.scope === 'hidden'
      ? 'Vous seul pourrez la retrouver, dans Mon compte.'
      : draft.scope === 'places'
        ? 'Les membres des lieux cochés pourront la trouver.'
        : 'Toute personne connectée à Mandala pourra la trouver, y compris sur la page publique.'

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950 text-slate-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <button type="button" onClick={close} className="text-sm text-slate-300">
          Fermer
        </button>
        <p className="text-xs uppercase tracking-[0.16em] text-violet-300">Étape {step} / 4</p>
        <span className="w-12" />
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-xl mx-auto w-full space-y-5">
        {step === 1 && (
          <>
            <h2 className="text-xl font-semibold">Quel type de ressource ?</h2>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({ ...empty(k.id as ResourceKind), scope: d.scope, place_ids: d.place_ids }))
                    setStep(2)
                  }}
                  className="px-3 py-2 rounded-full border border-slate-700 text-sm"
                >
                  {k.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && meta.mode === 'text' && (
          <>
            <h2 className="text-xl font-semibold">Collez le texte</h2>
            <textarea
              value={draft.body_text}
              onChange={(e) => setDraft((d) => ({ ...d, body_text: e.target.value }))}
              rows={10}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm"
              placeholder="Le texte de la recette, du récit…"
            />
            <label className="block text-sm text-slate-300">
              Images dans le texte ({formatByteLimit(MAX_IMAGE_BYTES)} chacune, {MAX_RESOURCE_IMAGES} maximum)
              <input type="file" accept="image/*" multiple className="mt-2 block w-full text-sm" onChange={(e) => addImages(e.target.files)} />
            </label>
            {draft.images.length > 0 && (
              <ul className="text-sm text-slate-400 space-y-1">
                {draft.images.map((file, i) => (
                  <li key={`${file.name}-${i}`}>{file.name}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {step === 2 && meta.mode === 'file' && (
          <>
            <h2 className="text-xl font-semibold">Ajoutez le fichier</h2>
            <p className="text-sm text-slate-400">Taille maximum : {fileLimit}.</p>
            {editing?.file_name && !draft.file && (
              <p className="text-sm text-slate-300">Fichier actuel : {editing.file_name}. Choisissez-en un autre seulement pour le remplacer.</p>
            )}
            <input
              type="file"
              className="block w-full text-sm"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {draft.file && <p className="text-sm text-slate-300">{draft.file.name}</p>}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-xl font-semibold">Présentez-la</h2>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Titre"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <input
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
              placeholder="Une ligne pour la retrouver"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <div>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Mot-clé, puis Entrée"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {draft.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="text-xs px-2 py-1 rounded-full bg-slate-800"
                    onClick={() => setDraft((d) => ({ ...d, tags: d.tags.filter((t) => t !== tag) }))}
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm text-slate-300">
              Image de couverture
              <input
                type="file"
                accept="image/*"
                className="mt-2 block w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (!isAllowedImageMime(file.type) || file.size > MAX_IMAGE_BYTES) {
                    setError(`Couverture : image, ${formatByteLimit(MAX_IMAGE_BYTES)} maximum.`)
                    return
                  }
                  setDraft((d) => ({ ...d, cover: file, clear_cover: false }))
                }}
              />
            </label>
            {draft.file?.type.startsWith('image/') && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useFileAsCover} onChange={(e) => setUseFileAsCover(e.target.checked)} />
                Utiliser le fichier comme couverture
              </label>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-xl font-semibold">Qui peut trouver ça ?</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['hidden', 'Personne'],
                  ['places', 'Les membres de mes lieux'],
                  ['mandala', 'Tout Mandala'],
                ] as Array<[ResourceScope, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, scope: id }))}
                  className={`px-3 py-2 rounded-full border text-sm ${draft.scope === id ? 'border-violet-400 text-violet-200' : 'border-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {draft.scope === 'places' && (
              <ul className="space-y-2">
                {communities.map((c) => (
                  <li key={c.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.place_ids.includes(c.id)}
                        onChange={() =>
                          setDraft((d) => ({
                            ...d,
                            place_ids: d.place_ids.includes(c.id)
                              ? d.place_ids.filter((id) => id !== c.id)
                              : [...d.place_ids, c.id],
                          }))
                        }
                      />
                      {c.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-slate-300">{scopeSentence}</p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.downloadable}
                onChange={(e) => setDraft((d) => ({ ...d, downloadable: e.target.checked }))}
              />
              <span>
                Proposer le téléchargement.
                {draft.downloadable
                  ? ' Un bouton Télécharger apparaîtra dans la fiche.'
                  : ' Le fichier se lit dans Mandala, sans bouton de téléchargement.'}
              </span>
            </label>
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      <footer className="px-4 py-3 border-t border-slate-800 flex justify-between max-w-xl mx-auto w-full">
        <button type="button" className="text-sm text-slate-300" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
          Retour
        </button>
        {step < 4 ? (
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-violet-600 text-sm"
            onClick={() => {
              if (step === 2 && meta.mode === 'text' && !draft.body_text.trim()) {
                setError('Collez le texte avant de continuer.')
                return
              }
              if (step === 2 && meta.mode === 'file' && !draft.file && !editing?.has_file) {
                setError('Ajoutez le fichier avant de continuer.')
                return
              }
              if (step === 3 && !draft.title.trim()) {
                setError('Donnez un titre.')
                return
              }
              setError(null)
              setStep((s) => s + 1)
            }}
          >
            Continuer
          </button>
        ) : (
          <button type="button" disabled={busy} className="px-4 py-2 rounded-lg bg-violet-600 text-sm disabled:opacity-50" onClick={() => void publish()}>
            {busy ? 'Publication…' : editing ? 'Enregistrer' : 'Publier'}
          </button>
        )}
      </footer>
    </div>
  )
}
