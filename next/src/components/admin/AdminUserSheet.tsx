'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminManagedUser } from '@/api/admin'
import { managerApi } from '@/api/manager'
import { ApiError } from '@/lib/api-client'
import { formatPublicDisplayName } from '@/lib/mandala-display-name'
import {
  formatCommunityRoleLabel,
  isCommunityManagerRole,
} from '@/lib/community-role-labels'
import type { CommunityRole } from '@/lib/db-communities'
import { RemoveMemberConfirmDialog } from '@/components/admin/RemoveMemberConfirmDialog'
import { useCommunity } from '@/contexts/CommunityContext'
import { useAuth } from '@/contexts/AuthContext'

function generateClientPassword(length = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function AdminUserSheet({
  userId,
  communitySlug,
  communityName,
  canEditAppRole = false,
  canEditCommunityRoles = false,
  onClose,
  onSaved,
  onRemoved,
}: {
  userId: number
  communitySlug?: string
  communityName?: string
  canEditAppRole?: boolean
  /** Modifier le rôle sur un ou plusieurs lieux (gestionnaire ou admin app). */
  canEditCommunityRoles?: boolean
  onClose: () => void
  onSaved?: () => void
  onRemoved?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [profile, setProfile] = useState<AdminManagedUser | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showFullLastName, setShowFullLastName] = useState(false)
  const [bio, setBio] = useState('')
  const [profilePublic, setProfilePublic] = useState(true)
  const [appRole, setAppRole] = useState('user')

  const [tempPassword, setTempPassword] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [lastReset, setLastReset] = useState<{
    password: string
    emailSent: boolean
    emailConfigured: boolean
  } | null>(null)

  const [removeSlug, setRemoveSlug] = useState(communitySlug ?? '')
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [roleSavingSlug, setRoleSavingSlug] = useState<string | null>(null)
  const { refresh: refreshCommunities } = useCommunity()
  const { user } = useAuth()
  const currentUserId = Number((user as { id?: number })?.id ?? 0)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const u = await adminApi.users.get(userId, communitySlug)
      setProfile(u)
      setFirstName(u.first_name ?? '')
      setLastName(u.last_name ?? '')
      setShowFullLastName(!!u.show_full_last_name)
      setBio(u.bio ?? '')
      setProfilePublic(u.profile_public !== false)
      setAppRole(u.app_role === 'coach' ? 'site_manager' : u.app_role ?? 'user')
      if (communitySlug) {
        setRemoveSlug(communitySlug)
      } else if (u.communities?.length === 1) {
        setRemoveSlug(u.communities[0].slug)
      }
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Impossible de charger la fiche')
    } finally {
      setLoading(false)
    }
  }, [userId, communitySlug])

  useEffect(() => {
    void load()
  }, [load])

  const saveProfile = async () => {
    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      const body: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        show_full_last_name: showFullLastName,
        bio: bio.trim(),
        profile_public: profilePublic,
      }
      if (communitySlug) body.community_slug = communitySlug
      if (canEditAppRole) body.app_role = appRole
      const u = await adminApi.users.update(userId, body)
      setProfile(u)
      setMsg('Fiche enregistrée')
      onSaved?.()
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Erreur à l’enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const resetPassword = async () => {
    setResetting(true)
    setErr(null)
    setMsg(null)
    setLastReset(null)
    try {
      const pwd = tempPassword.trim() || generateClientPassword()
      const res = await adminApi.users.resetPassword(userId, {
        password: pwd,
        send_email: sendEmail,
        community_slug: communitySlug,
      })
      setTempPassword(res.temporary_password)
      setLastReset({
        password: res.temporary_password,
        emailSent: res.email_sent,
        emailConfigured: res.email_configured,
      })
      if (res.email_sent) {
        setMsg('Mot de passe réinitialisé et envoyé par e-mail')
      } else if (res.email_configured) {
        setMsg('Mot de passe réinitialisé (échec envoi e-mail — copiez-le ci-dessous)')
      } else {
        setMsg('Mot de passe réinitialisé — copiez-le et transmettez-le au membre')
      }
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Erreur réinitialisation')
    } finally {
      setResetting(false)
    }
  }

  const copyPassword = async () => {
    if (!lastReset?.password) return
    try {
      await navigator.clipboard.writeText(lastReset.password)
      setMsg('Mot de passe copié')
    } catch {
      setErr('Copie impossible — sélectionnez le mot de passe manuellement')
    }
  }

  const mailtoLink = () => {
    if (!profile?.email || !lastReset?.password) return '#'
    const subject = encodeURIComponent('Votre mot de passe temporaire Mandala')
    const body = encodeURIComponent(
      `Bonjour,\n\nVoici votre mot de passe temporaire Mandala : ${lastReset.password}\n\nConnectez-vous puis changez-le dans « Mon compte ».\n\n— Mandala`
    )
    return `mailto:${profile.email}?subject=${subject}&body=${body}`
  }

  const publicName =
    firstName.trim() || lastName.trim()
      ? formatPublicDisplayName(firstName, lastName, showFullLastName)
      : profile?.pseudo ?? ''

  const removableCommunities = (() => {
    const all = profile?.communities ?? []
    if (communitySlug) {
      const match = all.filter((c) => c.slug === communitySlug)
      if (match.length) return match
      if (communityName) {
        return [{ slug: communitySlug, name: communityName, role: 'member', logo_emoji: null, id: 0 }]
      }
      return []
    }
    return all
  })()

  const selectedRemovePlace =
    removableCommunities.find((c) => c.slug === removeSlug) ??
    (communitySlug && communityName
      ? { slug: communitySlug, name: communityName, role: 'member' }
      : null)

  const managedPlaces = (profile?.communities ?? []).filter((c) => isCommunityManagerRole(c.role))
  const memberPlaces = (profile?.communities ?? []).filter((c) => !isCommunityManagerRole(c.role))

  const canEditRoleOnCommunity = (slug: string) =>
    canEditAppRole || (canEditCommunityRoles && (!communitySlug || communitySlug === slug))

  const updateCommunityRole = async (communityId: number, slug: string, role: CommunityRole) => {
    setRoleSavingSlug(slug)
    setErr(null)
    setMsg(null)
    try {
      if (canEditAppRole) {
        await adminApi.communities.setMemberRole(communityId, userId, role)
      } else {
        await managerApi.communities.setMemberRole(communityId, userId, role)
      }
      setMsg(`Rôle mis à jour sur ${slug}`)
      await load()
      await refreshCommunities()
      onSaved?.()
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Impossible de modifier le rôle')
    } finally {
      setRoleSavingSlug(null)
    }
  }

  const canRemoveMember =
    (canEditAppRole || canEditCommunityRoles) &&
    removableCommunities.length > 0 &&
    userId !== currentUserId

  const memberLabel = publicName || profile?.name || profile?.email || `Membre #${userId}`

  const confirmRemove = async () => {
    if (!removeSlug) return
    setRemoving(true)
    setErr(null)
    try {
      if (canEditAppRole) {
        await adminApi.users.removeFromCommunity(userId, removeSlug)
      } else {
        await managerApi.communities.removeFromCommunity(userId, removeSlug)
      }
      setShowRemoveConfirm(false)
      onRemoved?.()
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Erreur lors du retrait')
      setShowRemoveConfirm(false)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal="true">
      <button type="button" className="flex-1" aria-label="Fermer" onClick={onClose} />
      <aside className="w-full max-w-md h-full overflow-y-auto border-l border-slate-800 bg-slate-900 shadow-xl flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3">
          <h2 className="font-semibold text-sm">Fiche membre</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none px-2"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {loading && <p className="text-sm text-slate-500">Chargement…</p>}
          {err && <p className="text-sm text-red-400">{err}</p>}
          {msg && <p className="text-sm text-emerald-400">{msg}</p>}

          {!loading && profile && (
            <>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-1 text-sm">
                <p>
                  <span className="text-slate-500">Email : </span>
                  {profile.email}
                </p>
                <p>
                  <span className="text-slate-500">Identifiant : </span>
                  {profile.login}
                </p>
                {publicName && (
                  <p>
                    <span className="text-slate-500">Nom public : </span>
                    {publicName}
                  </p>
                )}
              </div>

              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-widest text-violet-300">Identité</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="text-slate-500">Prénom</span>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-500">Nom</span>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFullLastName}
                    onChange={(e) => setShowFullLastName(e.target.checked)}
                    className="rounded"
                  />
                  <span>Nom de famille complet dans les listes</span>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profilePublic}
                    onChange={(e) => setProfilePublic(e.target.checked)}
                    className="rounded"
                  />
                  <span>Profil visible dans Membres</span>
                </label>
                {canEditAppRole && (
                  <label className="block text-sm">
                    <span className="text-slate-500">Rôle application</span>
                    <select
                      value={appRole}
                      onChange={(e) => setAppRole(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                    >
                      <option value="user">Utilisateur</option>
                      <option value="site_manager">Gestionnaire</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveProfile()}
                  className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer la fiche'}
                </button>
              </section>

              {(profile.communities?.length ?? 0) > 0 && (
                <section className="space-y-3 border-t border-slate-800 pt-4">
                  <h3 className="text-xs uppercase tracking-widest text-sky-300">Lieux &amp; rôles</h3>
                  {managedPlaces.length > 0 && (
                    <div className="rounded-lg border border-sky-800/40 bg-sky-950/20 p-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-sky-400/90">
                        Gestionnaire de {managedPlaces.length} lieu
                        {managedPlaces.length > 1 ? 'x' : ''}
                      </p>
                      <ul className="space-y-1">
                        {managedPlaces.map((c) => (
                          <li key={c.slug} className="text-sm font-medium text-sky-100">
                            {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                            {c.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {memberPlaces.length > 0 && managedPlaces.length > 0 && (
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">
                      Autres adhésions
                    </p>
                  )}
                  <ul className="space-y-2">
                    {profile.communities!.map((c) => (
                      <li
                        key={c.slug}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                      >
                        <span className="text-sm min-w-0 truncate">
                          {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                          {c.name}
                        </span>
                        {canEditRoleOnCommunity(c.slug) ? (
                          <select
                            value={c.role}
                            disabled={roleSavingSlug === c.slug}
                            onChange={(e) =>
                              void updateCommunityRole(
                                c.id,
                                c.slug,
                                e.target.value as CommunityRole
                              )
                            }
                            className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-xs shrink-0"
                          >
                            <option value="member">Membre</option>
                            <option value="organizer">Gestionnaire</option>
                            <option value="admin">Gestionnaire (admin)</option>
                          </select>
                        ) : (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                              isCommunityManagerRole(c.role)
                                ? 'bg-sky-900/50 text-sky-200'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {formatCommunityRoleLabel(c.role)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!managedPlaces.length && (
                    <p className="text-xs text-slate-500">
                      Cette personne n&apos;est gestionnaire d&apos;aucun lieu pour le moment.
                    </p>
                  )}
                </section>
              )}

              {canRemoveMember && (
                <section className="space-y-3 border-t border-red-900/30 pt-4">
                  <h3 className="text-xs uppercase tracking-widest text-red-400">Retirer du lieu</h3>
                  <p className="text-xs text-slate-500">
                    Retire la personne du lieu et efface toutes ses données associées à ce lieu
                    (calendrier, Agora, météo…). Le compte Mandala global est conservé.
                  </p>
                  {!communitySlug && removableCommunities.length > 1 && (
                    <label className="block text-sm">
                      <span className="text-slate-500">Lieu concerné</span>
                      <select
                        value={removeSlug}
                        onChange={(e) => setRemoveSlug(e.target.value)}
                        className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                      >
                        {removableCommunities.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                            {c.name} ({formatCommunityRoleLabel(c.role)})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {communitySlug && selectedRemovePlace && (
                    <p className="text-sm text-slate-300">
                      Lieu : <span className="font-medium">{selectedRemovePlace.name}</span>
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={!removeSlug}
                    onClick={() => setShowRemoveConfirm(true)}
                    className="w-full py-2.5 rounded-lg bg-red-950/50 border border-red-700/60 text-red-200 text-sm font-medium hover:bg-red-950/80 disabled:opacity-50"
                  >
                    Retirer de ce lieu…
                  </button>
                </section>
              )}

              <section className="space-y-3 border-t border-slate-800 pt-4">
                <h3 className="text-xs uppercase tracking-widest text-amber-300">Mot de passe</h3>
                <p className="text-xs text-slate-500">
                  Définissez un mot de passe temporaire ou laissez vide pour en générer un
                  automatiquement.
                </p>
                <label className="block text-sm">
                  <span className="text-slate-500">Nouveau mot de passe</span>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Généré automatiquement si vide"
                      autoComplete="off"
                      className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setTempPassword(generateClientPassword())}
                      className="px-3 py-2 rounded-lg border border-slate-700 text-xs shrink-0"
                    >
                      Générer
                    </button>
                  </div>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded"
                  />
                  <span>Tenter l&apos;envoi par e-mail (si configuré)</span>
                </label>
                <button
                  type="button"
                  disabled={resetting}
                  onClick={() => void resetPassword()}
                  className="w-full py-2 rounded-lg border border-amber-700/60 text-amber-100 text-sm hover:bg-amber-950/30 disabled:opacity-50"
                >
                  {resetting ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
                </button>

                {lastReset && (
                  <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 space-y-2 text-sm">
                    <p className="font-mono text-amber-100 break-all">{lastReset.password}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyPassword()}
                        className="text-xs px-2 py-1 rounded border border-slate-700"
                      >
                        Copier
                      </button>
                      <a
                        href={mailtoLink()}
                        className="text-xs px-2 py-1 rounded border border-slate-700 text-violet-300"
                      >
                        Ouvrir dans ma messagerie
                      </a>
                    </div>
                    {!lastReset.emailConfigured && (
                      <p className="text-[10px] text-slate-500">
                        E-mail automatique non configuré (variable RESEND_API_KEY). Transmettez le
                        mot de passe manuellement.
                      </p>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>

      {showRemoveConfirm && selectedRemovePlace && (
        <RemoveMemberConfirmDialog
          memberLabel={memberLabel}
          placeName={selectedRemovePlace.name}
          loading={removing}
          onCancel={() => setShowRemoveConfirm(false)}
          onConfirm={() => void confirmRemove()}
        />
      )}
    </div>
  )
}
