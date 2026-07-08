'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { communitiesApi } from '@/api/communities'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { formatCommunityRoleLabel } from '@/lib/community-role-labels'

type CatalogItem = {
  slug: string
  name: string
  tagline?: string | null
  logo_emoji?: string | null
  accent_color?: string | null
  avatar?: string | null
  is_member: boolean
}

export function CommunitySwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { communities, active, setActiveSlug, refresh, joinCommunity } = useCommunity()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null)
  const [joinMsg, setJoinMsg] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [createMsg, setCreateMsg] = useState<string | null>(null)
  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), [])

  useEffect(() => {
    if (!open) return
    setCatalogLoading(true)
    void communitiesApi
      .catalog()
      .then((res) => setCatalog((res as { items?: CatalogItem[] }).items ?? []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false))
  }, [open])

  if (!open) return null

  const available = catalog.filter((c) => !c.is_member)

  const modal = (
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-700 bg-slate-900 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <h2 className="font-semibold">Mes communautés</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xl" aria-label="Fermer">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <section>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Mes espaces</p>
            <ul className="space-y-2">
              {communities.map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => { setActiveSlug(c.slug); onClose() }}
                    className={`w-full text-left flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      active?.slug === c.slug
                        ? 'border-violet-500/50 bg-violet-950/40'
                        : 'border-slate-800 bg-slate-950/30 hover:border-slate-600'
                    }`}
                  >
                    <CommunityAvatar
                      avatar={c.avatar}
                      logoEmoji={c.logo_emoji}
                      accentColor={c.accent_color}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                      {c.tagline && <p className="text-xs text-slate-500 truncate">{c.tagline}</p>}
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">{formatCommunityRoleLabel(c.role)}</span>
                    {active?.slug === c.slug && (
                      <span className="text-[10px] text-violet-400 shrink-0">Actif</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="w-full py-2 rounded-lg border border-dashed border-slate-600 text-sm text-slate-400"
          >
            {showCreate ? 'Annuler création' : '+ Créer une communauté'}
          </button>
          {showCreate && (
            <div className="space-y-2 rounded-xl border border-slate-800 p-3">
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="slug"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              />
              {createMsg && <p className="text-xs text-emerald-400">{createMsg}</p>}
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    setCreateMsg(null)
                    try {
                      await communitiesApi.create({
                        slug: newSlug.trim(),
                        name: newName.trim(),
                        logo_emoji: '🏛️',
                      })
                      await refresh()
                      setActiveSlug(newSlug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, ''))
                      setShowCreate(false)
                      onClose()
                    } catch (e: unknown) {
                      setCreateMsg(e instanceof ApiError ? e.detail : 'Erreur')
                    }
                  })()
                }}
                className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm"
              >
                Créer
              </button>
            </div>
          )}
          {available.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Rejoindre</p>
              {catalogLoading ? (
                <p className="text-sm text-slate-400">Chargement…</p>
              ) : (
                available.map((c) => (
                  <div key={c.slug} className="flex items-center gap-2 rounded-lg border border-slate-800 p-2">
                    <CommunityAvatar
                      avatar={c.avatar}
                      logoEmoji={c.logo_emoji}
                      accentColor={c.accent_color}
                      size="xs"
                    />
                    <span className="flex-1 text-sm truncate">{c.name}</span>
                    <button
                      type="button"
                      disabled={joiningSlug === c.slug}
                      onClick={() => {
                        void (async () => {
                          setJoinMsg(null)
                          setJoiningSlug(c.slug)
                          try {
                            await joinCommunity(c.slug)
                            onClose()
                          } catch (e: unknown) {
                            setJoinMsg(e instanceof ApiError ? e.detail : 'Erreur')
                          } finally {
                            setJoiningSlug(null)
                          }
                        })()
                      }}
                      className="text-xs px-2 py-1 rounded bg-violet-600 text-white disabled:opacity-50"
                    >
                      {joiningSlug === c.slug ? '…' : 'Rejoindre'}
                    </button>
                  </div>
                ))
              )}
              {joinMsg && <p className="text-xs text-red-400">{joinMsg}</p>}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button type="button" onClick={onClose} className="w-full py-2 rounded-lg border border-slate-600 text-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )

  // Portal : garantit un vrai "fixed" relatif au viewport (évite les parents transform/overflow).
  return portalTarget ? createPortal(modal, portalTarget) : modal
}
