'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supportApi, type SupportReportItem, type SupportStatus } from '@/api/support'
import { ApiError } from '@/lib/api-client'
import { PAGE_LABELS } from '@/lib/nav'
import type { MandalaPage } from '@/components/MandalaApp'

const STATUS_LABEL: Record<SupportStatus, string> = {
  new: 'Nouveau',
  read: 'Lu',
  done: 'Traité',
}

function pageLabel(page: string): string {
  return PAGE_LABELS[page as MandalaPage] ?? page
}

export function AdminSupportTab() {
  const [items, setItems] = useState<SupportReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [selectedDoneIds, setSelectedDoneIds] = useState<number[]>([])
  const [batchBusy, setBatchBusy] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await supportApi.list()
      setItems(data.items ?? [])
      setSelectedDoneIds([])
    } catch (err: unknown) {
      setItems([])
      setError(err instanceof ApiError ? err.detail : 'Impossible de charger les retours')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const setStatus = async (id: number, status: SupportStatus) => {
    setBusyId(id)
    setError(null)
    try {
      await supportApi.setStatus(id, status)
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
      if (status !== 'done') {
        setSelectedDoneIds((prev) => prev.filter((selected) => selected !== id))
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Mise à jour impossible')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Supprimer ce retour traité ? Cette action est définitive.')) return
    setBusyId(id)
    setError(null)
    try {
      await supportApi.remove(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setSelectedDoneIds((prev) => prev.filter((selected) => selected !== id))
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Suppression impossible')
    } finally {
      setBusyId(null)
    }
  }

  const removeSelected = async () => {
    if (!selectedDoneIds.length) return
    const n = selectedDoneIds.length
    if (
      !window.confirm(
        `Supprimer ${n} retour${n > 1 ? 's' : ''} traité${n > 1 ? 's' : ''} ? Cette action est définitive.`
      )
    ) {
      return
    }
    setBatchBusy(true)
    setError(null)
    try {
      await supportApi.removeMany(selectedDoneIds)
      const removed = new Set(selectedDoneIds)
      setItems((prev) => prev.filter((item) => !removed.has(item.id)))
      setSelectedDoneIds([])
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Suppression groupée impossible')
      await load()
    } finally {
      setBatchBusy(false)
    }
  }

  const openItems = items.filter((item) => item.status !== 'done')
  const doneItems = items.filter((item) => item.status === 'done')
  const allDoneSelected =
    doneItems.length > 0 && doneItems.every((item) => selectedDoneIds.includes(item.id))

  const toggleDone = (id: number) => {
    setSelectedDoneIds((prev) =>
      prev.includes(id) ? prev.filter((selected) => selected !== id) : [...prev, id]
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Retours</h2>
      <p className="text-sm text-slate-400">
        Questions et bugs envoyés depuis le bouton ? de l’application. Une fois traités, ils
        quittent cette liste et restent dans l’historique.
      </p>
      <button
        type="button"
        onClick={() => void load()}
        className="text-sm px-3 py-1 border border-slate-700 rounded-lg"
      >
        Rafraîchir
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-slate-500 text-sm">Chargement…</p>}
      {!loading && openItems.length === 0 && (
        <p className="text-slate-500 text-sm italic">Aucun retour en cours.</p>
      )}
      <ul className="space-y-3">
        {openItems.map((item) => (
          <ReportCard key={item.id} item={item} onOpenImage={setLightbox}>
            {item.status !== 'read' && (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void setStatus(item.id, 'read')}
                className="text-xs px-2 py-1 rounded-lg border border-slate-700 disabled:opacity-60"
              >
                Marquer lu
              </button>
            )}
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => void setStatus(item.id, 'done')}
              className="text-xs px-2 py-1 rounded-lg border border-slate-700 disabled:opacity-60"
            >
              Traité
            </button>
            {item.status !== 'new' && (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void setStatus(item.id, 'new')}
                className="text-xs px-2 py-1 rounded-lg border border-slate-700 disabled:opacity-60"
              >
                Remettre en nouveau
              </button>
            )}
          </ReportCard>
        ))}
      </ul>

      {!loading && doneItems.length > 0 && (
        <details className="group rounded-xl border border-slate-800 bg-slate-950/20">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm text-slate-300 flex items-center gap-2 [&::-webkit-details-marker]:hidden">
            <span className="text-slate-500 group-open:hidden" aria-hidden>
              ▸
            </span>
            <span className="text-slate-500 hidden group-open:inline" aria-hidden>
              ▾
            </span>
            <span>
              Historique
              <span className="text-slate-500">
                {' '}
                · {doneItems.length} traité{doneItems.length > 1 ? 's' : ''}
              </span>
            </span>
          </summary>
          <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
            <button
              type="button"
              disabled={batchBusy}
              onClick={() =>
                setSelectedDoneIds(allDoneSelected ? [] : doneItems.map((item) => item.id))
              }
              className="text-xs px-2 py-1 rounded-lg border border-slate-700 disabled:opacity-60"
            >
              {allDoneSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            {selectedDoneIds.length > 0 && (
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => void removeSelected()}
                className="text-xs px-2 py-1 rounded-lg border border-red-900 text-red-300 disabled:opacity-60"
              >
                {batchBusy
                  ? 'Suppression…'
                  : `Supprimer la sélection (${selectedDoneIds.length})`}
              </button>
            )}
          </div>
          <ul className="space-y-3 px-3 pb-3">
            {doneItems.map((item) => (
              <ReportCard
                key={item.id}
                item={item}
                muted
                selected={selectedDoneIds.includes(item.id)}
                onToggleSelect={() => toggleDone(item.id)}
                onOpenImage={setLightbox}
              >
                <button
                  type="button"
                  disabled={busyId === item.id || batchBusy}
                  onClick={() => void setStatus(item.id, 'new')}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-700 disabled:opacity-60"
                >
                  Remettre en nouveau
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id || batchBusy}
                  onClick={() => void remove(item.id)}
                  className="text-xs px-2 py-1 rounded-lg border border-red-900 text-red-300 disabled:opacity-60"
                >
                  Supprimer
                </button>
              </ReportCard>
            ))}
          </ul>
        </details>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/85"
            aria-label="Fermer l’image"
            onClick={() => setLightbox(null)}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Capture jointe"
            className="relative z-[81] max-h-[90vh] max-w-[min(96vw,56rem)] rounded-xl border border-slate-700 object-contain"
          />
        </div>
      )}
    </section>
  )
}

function ReportCard({
  item,
  muted = false,
  selected = false,
  onToggleSelect,
  onOpenImage,
  children,
}: {
  item: SupportReportItem
  muted?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onOpenImage: (src: string) => void
  children: ReactNode
}) {
  const images = item.images ?? []
  return (
    <li className={`rounded-xl border border-slate-800 p-3 space-y-2 ${muted ? 'bg-slate-950/20' : 'bg-slate-950/40'}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {onToggleSelect && (
          <label className="inline-flex items-center gap-1.5 text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="rounded border-slate-600"
            />
            <span className="sr-only">Sélectionner le retour #{item.id}</span>
          </label>
        )}
        <span
          className={`px-2 py-0.5 rounded-full ${
            item.kind === 'bug' ? 'bg-red-950 text-red-300' : 'bg-violet-950 text-violet-200'
          }`}
        >
          {item.kind === 'bug' ? 'Bug' : 'Question'}
        </span>
        <span className="text-slate-400">{STATUS_LABEL[item.status]}</span>
        <span className="text-slate-500">#{item.id}</span>
        <span className="text-slate-500">
          {item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : ''}
        </span>
      </div>
      <p className={`text-sm whitespace-pre-wrap ${muted ? 'text-slate-400' : 'text-slate-200'}`}>{item.message}</p>
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((src, index) => (
            <li key={`${item.id}-${index}`}>
              <button
                type="button"
                onClick={() => onOpenImage(src)}
                className="block rounded-lg border border-slate-700 overflow-hidden hover:border-violet-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Capture ${index + 1}`}
                  className="h-16 w-16 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        {item.author_name}
        {item.author_email ? ` · ${item.author_email}` : ''} · {pageLabel(item.page)}
        {item.community_slug ? ` · ${item.community_slug}` : ''}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </li>
  )
}
