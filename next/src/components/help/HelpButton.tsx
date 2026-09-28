'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { MandalaPage } from '@/components/MandalaApp'
import { supportApi, type SupportKind } from '@/api/support'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import { helpForPage } from '@/lib/help-topics'
import { PAGE_LABELS } from '@/lib/nav'

const POS_KEY = 'mdl_help_button_pos'
const DRAG_THRESHOLD_PX = 8
const VIEW_MARGIN_PX = 8
const FAB_SIZE_PX = 44

type FabPos = { x: number; y: number }

function clampFab(x: number, y: number, width = FAB_SIZE_PX, height = FAB_SIZE_PX): FabPos {
  const maxX = Math.max(VIEW_MARGIN_PX, window.innerWidth - width - VIEW_MARGIN_PX)
  const maxY = Math.max(VIEW_MARGIN_PX, window.innerHeight - height - VIEW_MARGIN_PX)
  return {
    x: Math.min(Math.max(VIEW_MARGIN_PX, x), maxX),
    y: Math.min(Math.max(VIEW_MARGIN_PX, y), maxY),
  }
}

function readSavedPos(): FabPos | null {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null
    return clampFab(parsed.x, parsed.y)
  } catch {
    return null
  }
}

function savePos(pos: FabPos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos))
  } catch {
    /* navigation privée ou quota */
  }
}

export function HelpButton({ page }: { page: MandalaPage }) {
  const { active } = useCommunity()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'help' | 'report'>('help')
  const [kind, setKind] = useState<SupportKind>('bug')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pos, setPos] = useState<FabPos | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    width: number
    height: number
    moved: boolean
    last: FabPos
  } | null>(null)
  const ignoreClickUntil = useRef(0)
  const openedFromClick = useRef(false)
  const customPos = useRef(false)

  const help = helpForPage(page)
  const aboveNav = page !== 'messages'

  useEffect(() => {
    const saved = readSavedPos()
    if (saved) {
      customPos.current = true
      setPos(saved)
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (!customPos.current) return
      setPos((current) => {
        if (!current) return current
        const next = clampFab(current.x, current.y)
        if (next.x === current.x && next.y === current.y) return current
        savePos(next)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openHelp = () => {
    setTab('help')
    setSent(false)
    setError(null)
    setOpen(true)
  }
  const openHelpRef = useRef(openHelp)
  openHelpRef.current = openHelp
  const stopDragListeners = useRef<(() => void) | null>(null)

  useEffect(() => () => stopDragListeners.current?.(), [])

  const onFabPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    stopDragListeners.current?.()
    const rect = event.currentTarget.getBoundingClientRect()
    const origin = clampFab(rect.left, rect.top, rect.width, rect.height)
    const drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      width: rect.width,
      height: rect.height,
      moved: false,
      last: origin,
    }
    dragRef.current = drag
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* le suivi fenêtre suffit si la capture est refusée */
    }

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== drag.pointerId) return
      const dx = moveEvent.clientX - drag.startX
      const dy = moveEvent.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      drag.moved = true
      setDragging(true)
      moveEvent.preventDefault()
      const next = clampFab(drag.originX + dx, drag.originY + dy, drag.width, drag.height)
      drag.last = next
      setPos(next)
    }
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== drag.pointerId) return
      stop()
      const dx = upEvent.clientX - drag.startX
      const dy = upEvent.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        drag.moved = true
        drag.last = clampFab(drag.originX + dx, drag.originY + dy, drag.width, drag.height)
      }
      dragRef.current = null
      setDragging(false)
      if (!drag.moved) {
        if (upEvent.type === 'pointercancel') return
        openedFromClick.current = false
        window.setTimeout(() => {
          if (openedFromClick.current) return
          openHelpRef.current()
        }, 40)
        return
      }
      ignoreClickUntil.current = performance.now() + 400
      customPos.current = true
      savePos(drag.last)
      setPos(drag.last)
    }
    const stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      stopDragListeners.current = null
    }
    stopDragListeners.current = stop
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const openReport = (nextKind: SupportKind) => {
    setKind(nextKind)
    setTab('report')
    setSent(false)
    setError(null)
    setOpen(true)
  }

  const submit = async () => {
    const text = message.trim()
    if (text.length < 8) {
      setError('Décrivez le sujet en quelques mots.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await supportApi.create({
        kind,
        message: text,
        page,
        community_slug: active?.slug ?? null,
      })
      setSent(true)
      setMessage('')
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Envoi impossible pour le moment.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onPointerDown={onFabPointerDown}
          onClick={() => {
            if (performance.now() < ignoreClickUntil.current) return
            openedFromClick.current = true
            openHelp()
          }}
          className={`fixed z-[60] touch-none select-none flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-violet-600 text-white text-lg font-semibold shadow-lg shadow-violet-950/40 hover:bg-violet-500 ${
            dragging ? 'cursor-grabbing scale-105' : 'cursor-grab'
          } ${
            pos
              ? ''
              : aboveNav
                ? 'right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6'
                : 'right-4 bottom-24 md:bottom-6'
          }`}
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          aria-label="Aide. Glisser pour déplacer le bouton."
          title="Glisser pour déplacer"
          aria-haspopup="dialog"
        >
          ?
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label="Fermer l’aide"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md max-h-[min(34rem,85vh)] overflow-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <h2 id={titleId} className="text-base font-semibold text-slate-100">
                Aide
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-w-[44px] min-h-[44px] rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 px-4 pt-2" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'help'}
                onClick={() => setTab('help')}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  tab === 'help' ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-300'
                }`}
              >
                Cette page
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'report'}
                onClick={() => setTab('report')}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  tab === 'report' ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-300'
                }`}
              >
                Signaler
              </button>
            </div>

            {tab === 'help' ? (
              <div className="px-4 py-4 space-y-3">
                <p className="text-sm font-medium text-slate-200">{help.title}</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {help.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openReport('question')}
                    className="px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Poser une question
                  </button>
                  <button
                    type="button"
                    onClick={() => openReport('bug')}
                    className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500"
                  >
                    Signaler un bug
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="px-4 py-4 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submit()
                }}
              >
                <p className="text-xs text-slate-500">
                  Page jointe : {PAGE_LABELS[page]}
                  {active?.name ? ` · ${active.name}` : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setKind('question')}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      kind === 'question'
                        ? 'bg-violet-600 text-white'
                        : 'border border-slate-700 text-slate-300'
                    }`}
                  >
                    Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('bug')}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      kind === 'bug' ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-300'
                    }`}
                  >
                    Bug
                  </button>
                </div>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder={
                    kind === 'bug'
                      ? 'Que s’est-il passé, et qu’attendiez-vous ?'
                      : 'Votre question sur l’utilisation…'
                  }
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                {sent && (
                  <p className="text-sm text-emerald-400">
                    Message envoyé. Il apparaît dans Administration → Retours.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500 disabled:opacity-60"
                >
                  {sending ? 'Envoi…' : 'Envoyer'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
