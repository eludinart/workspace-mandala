'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { PlaceOrgBackLink } from '@/components/place/PlaceOrgBackLink'
import { UserAvatar } from '@/components/UserAvatar'
import { managerApi, type InviteCandidate, type PlaceInviteInfo } from '@/api/manager'
import { useCommunity } from '@/contexts/CommunityContext'
import { useManagedPlaces } from '@/hooks/useManagedPlaces'
import { useNavAccess } from '@/hooks/useNavAccess'
import { ApiError } from '@/lib/api-client'

export function PlaceInvitesPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { active, refresh: refreshCommunities } = useCommunity()
  const { canManageActiveCommunity, loadingManagedPlaces } = useNavAccess()
  const { managedPlaces } = useManagedPlaces()
  const communityId =
    active?.id ?? managedPlaces.find((p) => p.slug === active?.slug)?.id ?? null

  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<InviteCandidate[]>([])
  const [invite, setInvite] = useState<PlaceInviteInfo | null>(null)
  const [emailConfigured, setEmailConfigured] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgOk, setMsgOk] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (q?: string) => {
    if (!communityId) return
    setLoading(true)
    try {
      const res = await managerApi.communities.invites(communityId, q)
      setCandidates(res.candidates ?? [])
      setInvite(res.invite)
      setEmailConfigured(!!res.email_configured)
      if (res.invite.join_mode_changed) {
        setMsg(
          'Le lieu était fermé : il est passé en « sur invitation » pour que le lien fonctionne (toujours hors catalogue public si vous l’avez masqué).'
        )
        setMsgOk(true)
      }
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Impossible de charger les invitations')
      setMsgOk(false)
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    const handle = window.setTimeout(() => void load(query), query ? 250 : 0)
    return () => window.clearTimeout(handle)
  }, [query, load])

  if (loadingManagedPlaces) {
    return <p className="text-sm text-slate-400">Chargement…</p>
  }

  if (!active || !canManageActiveCommunity) {
    return (
      <div className="max-w-lg rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-2">
        <h1 className="text-xl font-bold">Invitations</h1>
        <p className="text-sm text-slate-400">
          Sélectionnez un lieu dont vous êtes gestionnaire via « Mes lieux ».
        </p>
      </div>
    )
  }

  async function addMember(user: InviteCandidate) {
    if (!communityId) return
    setBusyId(user.id)
    setMsg(null)
    try {
      await managerApi.communities.addMember(communityId, user.id)
      setMsg(`${user.pseudo} a été ajouté·e à ${active?.name ?? 'ce lieu'}.`)
      setMsgOk(true)
      await refreshCommunities()
      await load(query)
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Ajout impossible')
      setMsgOk(false)
    } finally {
      setBusyId(null)
    }
  }

  async function copyLink() {
    if (!invite?.url) return
    try {
      await navigator.clipboard.writeText(invite.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setMsg('Copie impossible — sélectionnez le lien manuellement.')
      setMsgOk(false)
    }
  }

  async function sendEmail() {
    if (!communityId) return
    setSending(true)
    setMsg(null)
    try {
      const res = await managerApi.communities.sendInviteEmail(
        communityId,
        email.trim(),
        typeof window !== 'undefined' ? window.location.origin : undefined
      )
      setInvite(res.invite)
      if (res.email_sent) {
        setMsg(`Invitation envoyée à ${email.trim()}.`)
        setMsgOk(true)
        setEmail('')
      } else if (!res.email_configured) {
        setMsg(
          'L’envoi d’e-mail n’est pas configuré sur le serveur. Copiez le lien ci-dessous et envoyez-le vous-même.'
        )
        setMsgOk(false)
      } else {
        setMsg('L’e-mail n’a pas pu être envoyé. Copiez le lien et transmettez-le autrement.')
        setMsgOk(false)
      }
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Envoi impossible')
      setMsgOk(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      {onNavigate && active.slug && <PlaceOrgBackLink onNavigate={onNavigate} hubSlug={active.slug} />}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Invitations</h1>
        <p className="text-sm text-slate-400">
          Ajoutez des membres Mandala déjà inscrits, ou envoyez un lien pour rejoindre{' '}
          <span className="text-slate-200">{active.name}</span> — même s’il n’apparaît pas en public.
        </p>
      </header>

      {msg && (
        <p className={`text-sm rounded-lg px-3 py-2 ${msgOk ? 'bg-emerald-950/40 text-emerald-300' : 'bg-amber-950/30 text-amber-200'}`}>
          {msg}
        </p>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Lien d’invitation</h2>
        {invite ? (
          <>
            <p className="text-xs text-slate-500">
              Code :{' '}
              <span className="font-mono tracking-widest text-slate-200 text-sm">{invite.invite_code}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                value={invite.url}
                className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-300"
              />
              <button
                type="button"
                onClick={() => void copyLink()}
                className="shrink-0 px-3 py-2 rounded-lg bg-violet-600 text-sm text-white"
              >
                {copied ? 'Copié' : 'Copier le lien'}
              </button>
            </div>
            <button
              type="button"
              className="text-xs text-slate-400 underline"
              onClick={() => {
                void managerApi.communities
                  .rotateInvite(communityId!, typeof window !== 'undefined' ? window.location.origin : undefined)
                  .then((res) => {
                    setInvite(res.invite)
                    setMsg('Nouveau code généré. Les anciens liens ne fonctionnent plus.')
                    setMsgOk(true)
                  })
                  .catch((e: unknown) => {
                    setMsg(e instanceof ApiError ? e.detail : 'Régénération impossible')
                    setMsgOk(false)
                  })
              }}
            >
              Régénérer le code
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">{loading ? 'Chargement…' : 'Lien indisponible'}</p>
        )}

        <div className="pt-2 border-t border-slate-800 space-y-2">
          <p className="text-sm text-slate-300">Envoyer par e-mail</p>
          {!emailConfigured && (
            <p className="text-xs text-amber-200/80">
              L’envoi automatique n’est pas actif (SMTP non configuré). Vous pouvez quand même copier le
              lien.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="personne@exemple.org"
              className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={sending || !email.trim()}
              onClick={() => void sendEmail()}
              className="shrink-0 px-3 py-2 rounded-lg bg-sky-700 text-sm text-white disabled:opacity-50"
            >
              {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Membres Mandala hors de ce lieu</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un nom, un pseudo ou un e-mail…"
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        />
        {loading && candidates.length === 0 && <p className="text-sm text-slate-500">Chargement…</p>}
        {!loading && candidates.length === 0 && (
          <p className="text-sm text-slate-500">
            {query.trim()
              ? 'Aucun compte trouvé hors de ce lieu.'
              : 'Tous les comptes visibles sont déjà membres, ou affinez la recherche.'}
          </p>
        )}
        <ul className="divide-y divide-slate-800">
          {candidates.map((user) => (
            <li key={user.id} className="flex items-center gap-3 py-2.5">
              <UserAvatar avatar={null} avatarEmoji={user.avatar_emoji} size="sm" alt={user.pseudo} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-100 truncate">{user.pseudo || user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
              <button
                type="button"
                disabled={busyId === user.id}
                onClick={() => void addMember(user)}
                className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-50"
              >
                {busyId === user.id ? '…' : 'Ajouter'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
