'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { telemetryApi, type TelemetryEventItem } from '@/api/telemetry'
import { AdminCommunityBanner } from '@/components/admin/AdminCommunityBanner'
import { AdminUserSheet } from '@/components/admin/AdminUserSheet'
import { AdminCommunitiesTab } from '@/views/admin/AdminCommunitiesTab'
import { authApi } from '@/api/auth'
import { notificationsApi } from '@/api/notifications'
import { adminApi } from '@/api/admin'
import { useCommunity } from '@/contexts/CommunityContext'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api-client'

import type { AdminTabId } from '@/lib/nav'
type CommMode = 'announcement' | 'broadcast'

type AdminUser = {
  id: number
  login: string
  email: string
  name: string
  app_role: string
  wp_role: string
  pseudo: string | null
}

type AdminNotif = {
  id: number
  title: string
  type: string
  delivery_count: number
  read_count: number
  created_at: string | null
}

type BroadcastItem = {
  id: number
  title: string
  status: string
}

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

const TABS: { id: AdminTabId; label: string }[] = [
  { id: 'people', label: 'Personnes' },
  { id: 'communications', label: 'Communications' },
  { id: 'telemetry', label: 'Télémétrie' },
  { id: 'places', label: 'Lieux & communautés' },
]

function normalizeAdminTab(tab?: AdminTabId | 'technical'): AdminTabId {
  if (tab === 'technical') return 'telemetry'
  return tab ?? 'people'
}

export function AdminPage({
  initialTab = 'people',
}: {
  initialTab?: AdminTabId | 'technical'
}) {
  const { isRealAdmin, showAdminUi, actingRole, setActingRole } = useAuth()
  useCommunity()
  const [tab, setTab] = useState<AdminTabId>(() => normalizeAdminTab(initialTab))
  const [commMode, setCommMode] = useState<CommMode>('announcement')
  const [msg, setMsg] = useState<string | null>(null)
  const [msgOk, setMsgOk] = useState(true)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  const [adminNotifs, setAdminNotifs] = useState<AdminNotif[]>([])
  const [nTitle, setNTitle] = useState('')
  const [nBody, setNBody] = useState('')
  const [nRecipient, setNRecipient] = useState<'all' | 'role'>('all')
  const [nRole, setNRole] = useState('user')
  const [nPublishing, setNPublishing] = useState(false)
  const notifPublishInFlight = useRef(false)

  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([])
  const [bTitle, setBTitle] = useState('')
  const [bInappTitle, setBInappTitle] = useState('')
  const [bInappBody, setBInappBody] = useState('')
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const [telemetry, setTelemetry] = useState<TelemetryEventItem[]>([])
  const [telemetryLoading, setTelemetryLoading] = useState(false)

  useEffect(() => {
    setTab(normalizeAdminTab(initialTab))
  }, [initialTab])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const data = (await authApi.users({ search: userSearch })) as { items?: AdminUser[] }
      setUsers(data.items ?? [])
    } catch {
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [userSearch])

  const loadAdminNotifs = useCallback(async () => {
    try {
      const data = (await notificationsApi.adminList({ per_page: 30 })) as { items?: AdminNotif[] }
      setAdminNotifs(data.items ?? [])
    } catch {
      setAdminNotifs([])
    }
  }, [])

  const loadBroadcasts = useCallback(async () => {
    try {
      const data = (await adminApi.broadcasts.list()) as { items?: BroadcastItem[] }
      setBroadcasts(data.items ?? [])
    } catch {
      setBroadcasts([])
    }
  }, [])

  const onCommunitiesMessage = useCallback((text: string | null, ok = true) => {
    setMsg(text)
    setMsgOk(ok)
  }, [])

  const loadTelemetry = useCallback(async () => {
    setTelemetryLoading(true)
    try {
      const data = await telemetryApi.list({ from: isoDaysAgo(7), limit: 150 })
      setTelemetry(data.items ?? [])
    } catch {
      setTelemetry([])
    } finally {
      setTelemetryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isRealAdmin) return
    if (tab === 'people') void loadUsers()
    if (tab === 'communications') {
      void loadAdminNotifs()
      void loadBroadcasts()
    }
    if (tab === 'telemetry') void loadTelemetry()
  }, [tab, isRealAdmin, loadUsers, loadAdminNotifs, loadBroadcasts, loadTelemetry])

  if (!isRealAdmin) {
    return (
      <p className="text-slate-400 text-sm">
        Accès réservé aux administrateurs. Demandez le rôle « admin » dans{' '}
        <code className="text-violet-400">mdl_mandala_app_roles</code>.
      </p>
    )
  }

  if (!showAdminUi) {
    return (
      <div className="max-w-lg space-y-3 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4">
        <p className="text-sm text-amber-100">
          Vous êtes connecté en tant qu&apos;administrateur, mais la vue active est «{' '}
          {actingRole === 'site_manager' ? 'Gestionnaire' : 'Utilisateur'} ».
        </p>
        <p className="text-xs text-amber-200/80">
          Passez en mode Administrateur pour accéder à la télémétrie, aux utilisateurs et aux
          annonces.
        </p>
        <button
          type="button"
          onClick={() => setActingRole('admin')}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500"
        >
          Passer en mode Administrateur
        </button>
      </div>
    )
  }

  const setRole = async (userId: number, app_role: string) => {
    setMsg(null)
    try {
      await authApi.updateUser({ id: userId, app_role })
      setMsg('Rôle mis à jour')
      void loadUsers()
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Erreur')
    }
  }

  const sendNotification = async () => {
    if (notifPublishInFlight.current) return
    const title = nTitle.trim()
    if (!title) {
      setMsgOk(false)
      setMsg('Titre requis')
      return
    }
    notifPublishInFlight.current = true
    setNPublishing(true)
    setMsg(null)
    try {
      await notificationsApi.create({
        type: 'announcement',
        title,
        body: nBody.trim(),
        recipient_type: nRecipient,
        recipient_role: nRecipient === 'role' ? nRole : undefined,
        priority: 'normal',
      })
      setMsgOk(true)
      setMsg('Annonce envoyée')
      setNTitle('')
      setNBody('')
      void loadAdminNotifs()
    } catch (e: unknown) {
      setMsgOk(false)
      setMsg(e instanceof ApiError ? e.detail : 'Erreur')
    } finally {
      notifPublishInFlight.current = false
      setNPublishing(false)
    }
  }

  const createAndSendBroadcast = async () => {
    setMsg(null)
    try {
      const audience = {
        audience_type: 'all' as const,
        activity: 'any' as const,
        coach_listed: 'any' as const,
        exclude_admins: false,
        exclude_emails: [] as string[],
        respect_email_optout: true,
      }
      const { id } = (await adminApi.broadcasts.create({
        title: bTitle || 'Annonce Mandala',
        audience,
        channels: {
          inapp: {
            type: 'announcement',
            title: bInappTitle || bTitle,
            body: bInappBody,
            priority: 'normal',
          },
        },
      })) as { id: number }
      const enq = (await adminApi.broadcasts.enqueue(id)) as { queued?: number }
      setMsg(`Diffusion #${id} : ${enq.queued ?? 0} destinataires en file`)
      setBTitle('')
      setBInappTitle('')
      setBInappBody('')
      void loadBroadcasts()
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Erreur diffusion')
    }
  }

  const previewBroadcast = async () => {
    try {
      const res = (await adminApi.broadcasts.preview({
        audience_type: 'all',
        activity: 'any',
        coach_listed: 'any',
        exclude_admins: false,
        exclude_emails: [],
        respect_email_optout: true,
      })) as { count?: number }
      setPreviewCount(res.count ?? 0)
    } catch {
      setPreviewCount(null)
    }
  }

  const deleteAdminNotif = async (id: number) => {
    if (!window.confirm('Supprimer cette annonce et ses envois ?')) return
    setMsg(null)
    try {
      await notificationsApi.adminDelete({ ids: [id] })
      setMsgOk(true)
      setMsg('Annonce supprimée')
      void loadAdminNotifs()
    } catch (e: unknown) {
      setMsgOk(false)
      setMsg(e instanceof ApiError ? e.detail : 'Erreur suppression')
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <AdminCommunityBanner />
      <h1 className="text-2xl font-bold">Administration</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              tab === t.id ? 'bg-violet-600 text-white' : 'border border-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <p className={`text-sm ${msgOk ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>
      )}

      {tab === 'people' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Rechercher email, login, nom…"
              className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="px-3 py-2 rounded-lg border border-slate-700 text-sm"
            >
              Chercher
            </button>
          </div>
          {usersLoading && <p className="text-slate-500 text-sm">Chargement…</p>}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Nom</th>
                  <th className="text-left p-2">Pseudo</th>
                  <th className="text-left p-2">Rôle app</th>
                  <th className="text-left p-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                    <td className="p-2">{u.id}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.name || '—'}</td>
                    <td className="p-2">{u.pseudo ?? '—'}</td>
                    <td className="p-2">
                      <select
                        value={u.app_role === 'coach' ? 'site_manager' : u.app_role}
                        onChange={(e) => void setRole(u.id, e.target.value)}
                        className="rounded bg-slate-950 border border-slate-700 px-1 py-0.5"
                      >
                        <option value="user">user</option>
                        <option value="site_manager">gestionnaire</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(u.id)}
                        className="text-violet-300 hover:text-violet-200 text-[11px]"
                      >
                        Fiche →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedUserId != null && (
            <AdminUserSheet
              userId={selectedUserId}
              canEditAppRole
              canEditCommunityRoles
              onClose={() => setSelectedUserId(null)}
              onSaved={() => void loadUsers()}
              onRemoved={() => {
                setSelectedUserId(null)
                void loadUsers()
              }}
            />
          )}
        </div>
      )}

      {tab === 'communications' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Choisissez le type de communication à envoyer.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCommMode('announcement')}
              className={`text-left rounded-xl border p-4 transition-colors ${
                commMode === 'announcement'
                  ? 'border-violet-500 bg-violet-950/40'
                  : 'border-slate-800 hover:border-slate-600'
              }`}
            >
              <p className="font-semibold text-sm">Message rapide (Annonces)</p>
              <p className="text-xs text-slate-500 mt-1">
                Notification in-app immédiate, ciblée par rôle si besoin.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setCommMode('broadcast')}
              className={`text-left rounded-xl border p-4 transition-colors ${
                commMode === 'broadcast'
                  ? 'border-violet-500 bg-violet-950/40'
                  : 'border-slate-800 hover:border-slate-600'
              }`}
            >
              <p className="font-semibold text-sm">Campagne (Diffusions)</p>
              <p className="text-xs text-slate-500 mt-1">
                Campagne avec file d&apos;envoi et historique des diffusions.
              </p>
            </button>
          </div>

          {commMode === 'announcement' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 p-4 space-y-3">
                <h2 className="font-semibold text-sm">Nouvelle annonce in-app</h2>
                <input
                  value={nTitle}
                  onChange={(e) => setNTitle(e.target.value)}
                  placeholder="Titre"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                />
                <textarea
                  value={nBody}
                  onChange={(e) => setNBody(e.target.value)}
                  placeholder="Message"
                  rows={3}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                />
                <select
                  value={nRecipient}
                  onChange={(e) => setNRecipient(e.target.value as 'all' | 'role')}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                >
                  <option value="all">Tous les utilisateurs</option>
                  <option value="role">Par rôle</option>
                </select>
                {nRecipient === 'role' && (
                  <select
                    value={nRole}
                    onChange={(e) => setNRole(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  >
                    <option value="user">Utilisateurs</option>
                    <option value="coach">Coachs</option>
                    <option value="admin">Admins</option>
                  </select>
                )}
                <button
                  type="button"
                  disabled={nPublishing || !nTitle.trim()}
                  onClick={() => void sendNotification()}
                  className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {nPublishing ? 'Publication…' : 'Publier'}
                </button>
              </div>
              <div className="space-y-2">
                <h2 className="font-semibold text-sm">Historique annonces</h2>
                {adminNotifs.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-xs flex justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{n.title}</p>
                      <p className="text-slate-500">
                        {n.delivery_count} envois · {n.read_count} lus · {n.type}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteAdminNotif(n.id)}
                      className="shrink-0 text-red-400/80 hover:text-red-300 text-[10px]"
                      title="Supprimer"
                    >
                      Suppr.
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {commMode === 'broadcast' && (
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-slate-400">
                Diffusion in-app vers tous les membres (notification centre).
              </p>
              <input
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                placeholder="Titre interne campagne"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              />
              <input
                value={bInappTitle}
                onChange={(e) => setBInappTitle(e.target.value)}
                placeholder="Titre affiché"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              />
              <textarea
                value={bInappBody}
                onChange={(e) => setBInappBody(e.target.value)}
                placeholder="Corps du message"
                rows={3}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void previewBroadcast()}
                  className="px-3 py-2 rounded-lg border border-slate-700 text-sm"
                >
                  Aperçu audience
                </button>
                {previewCount != null && (
                  <span className="text-sm text-slate-400 self-center">{previewCount} personnes</span>
                )}
                <button
                  type="button"
                  onClick={() => void createAndSendBroadcast()}
                  className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm"
                >
                  Envoyer
                </button>
              </div>
              <h3 className="text-sm font-semibold">Campagnes récentes</h3>
              <ul className="text-xs space-y-1">
                {broadcasts.map((b) => (
                  <li key={b.id} className="text-slate-400">
                    #{b.id} {b.title} — <span className="text-violet-300">{b.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'telemetry' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Télémétrie</h2>
          <p className="text-sm text-slate-400">
            Événements d&apos;usage enregistrés sur les 7 derniers jours.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadTelemetry()}
              className="text-sm px-3 py-1 border border-slate-700 rounded-lg"
            >
              Rafraîchir
            </button>
            <button
              type="button"
              onClick={() => void telemetryApi.clear().then(() => loadTelemetry())}
              className="text-sm px-3 py-1 border border-red-800 text-red-400 rounded-lg"
            >
              Purger
            </button>
          </div>
          {telemetryLoading && <p className="text-slate-500 text-sm">Chargement…</p>}
          {!telemetryLoading && telemetry.length === 0 && (
            <p className="text-slate-500 text-sm italic">
              Aucun événement enregistré sur les 7 derniers jours. Naviguez dans l&apos;app puis
              cliquez Rafraîchir.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[32rem] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-400 sticky top-0">
                <tr>
                  <th className="text-left p-2">Heure</th>
                  <th className="text-left p-2">Événement</th>
                  <th className="text-left p-2">Feature</th>
                  <th className="text-left p-2">Durée</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.map((it) => {
                  const dur = (it.properties as { duration_ms?: number })?.duration_ms
                  const isErr = it.name === 'api_error'
                  return (
                    <tr
                      key={String(it.id)}
                      className={`border-t border-slate-800 ${isErr ? 'text-red-300' : ''}`}
                    >
                      <td className="p-2 whitespace-nowrap">
                        {new Date(it.ts).toLocaleString('fr-FR')}
                      </td>
                      <td className="p-2">{it.name}</td>
                      <td className="p-2">{it.feature ?? '—'}</td>
                      <td className="p-2">{dur != null ? `${dur} ms` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'places' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Lieux &amp; communautés</h2>
          <p className="text-sm text-slate-400">
            Gestion des sites enregistrés, membres et paramètres par lieu.
          </p>
          <AdminCommunitiesTab scope="app-admin" onMessage={onCommunitiesMessage} />
        </section>
      )}
    </div>
  )
}
