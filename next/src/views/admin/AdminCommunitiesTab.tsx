'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi, type CommunityAdmin, type CommunityMemberAdmin } from '@/api/admin'
import { managerApi } from '@/api/manager'
import { communitiesApi } from '@/api/communities'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import { compressAvatarImage } from '@/lib/compress-avatar-image'
import { isAvatarImageUrl } from '@/lib/user-avatar'

export function AdminCommunitiesTab({
  onMessage,
  scope = 'app-admin',
}: {
  onMessage: (msg: string | null, ok?: boolean) => void
  /** app-admin : tous les lieux (admin application). managed : lieux dont l'utilisateur est gestionnaire. */
  scope?: 'app-admin' | 'managed'
}) {
  const isAppAdminScope = scope === 'app-admin'
  const communitiesApiClient = isAppAdminScope ? adminApi.communities : managerApi.communities
  const { refresh } = useCommunity()
  const [list, setList] = useState<CommunityAdmin[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CommunityAdmin | null>(null)
  const [members, setMembers] = useState<CommunityMemberAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editTagline, setEditTagline] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editDesc, setEditDesc] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAvatar, setEditAvatar] = useState<string | null>(null)

  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)

  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await communitiesApiClient.list()
      setList(data.items ?? [])
    } catch {
      setList([])
      onMessageRef.current('Impossible de charger les communautés', false)
    } finally {
      setLoading(false)
    }
  }, [communitiesApiClient])

  const loadDetail = useCallback(async (id: number) => {
      setDetailLoading(true)
      try {
        setDetailError(null)
        const data = await communitiesApiClient.get(id)
        setDetail(data.community)
        setMembers(data.members ?? [])
        setEditName(data.community.name)
        setEditSlug(data.community.slug)
        setEditTagline(data.community.tagline ?? '')
        setEditEmoji(data.community.logo_emoji ?? '🏛️')
        setEditColor(data.community.accent_color ?? '#7c3aed')
        setEditActive(data.community.is_active)
        setEditDesc(data.community.description ?? '')
        setEditLocation(data.community.location ?? '')
        setEditWebsite(data.community.website ?? '')
        setEditEmail(data.community.contact_email ?? '')
        const av = data.community.avatar
        setEditAvatar(isAvatarImageUrl(av) ? av : null)
      } catch (e: unknown) {
        const err = e instanceof ApiError ? e.detail : 'Erreur chargement'
        setDetail(null)
        setDetailError(err)
        onMessageRef.current(err, false)
      } finally {
        setDetailLoading(false)
      }
  }, [communitiesApiClient])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
    else {
      setDetail(null)
      setMembers([])
    }
  }, [selectedId, loadDetail])

  const saveCommunity = async () => {
    if (!selectedId) return
    setSaving(true)
    onMessage(null)
    try {
      const body: Record<string, unknown> = {
        name: editName,
        tagline: editTagline || null,
        description: editDesc || null,
        location: editLocation || null,
        website: editWebsite || null,
        contact_email: editEmail || null,
        logo_emoji: editEmoji,
        accent_color: editColor,
      }
      if (isAppAdminScope) {
        body.slug = editSlug
        body.is_active = editActive
      }
      const loadedAvatar =
        detail?.avatar && isAvatarImageUrl(detail.avatar) ? detail.avatar : null
      if (editAvatar !== loadedAvatar) {
        body.avatar = editAvatar
      }
      const { community } = await communitiesApiClient.update(selectedId, body)
      setDetail(community)
      onMessage('Communauté enregistrée')
      await loadDetail(selectedId)
      await loadList()
      await refresh()
    } catch (e: unknown) {
      onMessage(e instanceof ApiError ? e.detail : 'Erreur enregistrement', false)
    } finally {
      setSaving(false)
    }
  }

  const setMemberRole = async (userId: number, role: string) => {
    if (!selectedId) return
    onMessage(null)
    try {
      await communitiesApiClient.setMemberRole(selectedId, userId, role)
      onMessage('Rôle membre mis à jour')
      void loadDetail(selectedId)
    } catch (e: unknown) {
      onMessage(e instanceof ApiError ? e.detail : 'Erreur rôle', false)
    }
  }

  const onAvatarFile = async (file: File | null) => {
    if (!file) {
      setEditAvatar(null)
      return
    }
    const { dataUrl, error } = await compressAvatarImage(file)
    if (error || !dataUrl) {
      onMessage(error ?? 'Image invalide', false)
      return
    }
    setEditAvatar(dataUrl)
  }

  const createCommunity = async () => {
    onMessage(null)
    try {
      await communitiesApi.create({
        slug: newSlug.trim(),
        name: newName.trim(),
        logo_emoji: '🏛️',
      })
      onMessage(`Communauté « ${newName} » créée`)
      setNewSlug('')
      setNewName('')
      await loadList()
      await refresh()
    } catch (e: unknown) {
      onMessage(e instanceof ApiError ? e.detail : 'Erreur création', false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-4">
      <div className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wide">
          {isAppAdminScope ? 'Communautés' : 'Mes lieux'}
        </p>
        {loading && <p className="text-slate-500 text-sm">Chargement…</p>}
        <ul className="space-y-1">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  selectedId === c.id
                    ? 'bg-violet-600/30 border border-violet-500/50 text-violet-100'
                    : 'border border-transparent hover:bg-slate-900 text-slate-300'
                } ${!c.is_active ? 'opacity-50' : ''}`}
              >
                <CommunityAvatar
                  avatar={null}
                  logoEmoji={c.logo_emoji}
                  accentColor={c.accent_color}
                  size="xs"
                  className="inline-block mr-1 align-middle"
                />
                {c.name}
                <span className="block text-[10px] text-slate-500">
                  {c.member_count} membres · {c.slug}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {!loading && list.length === 0 && (
          <p className="text-slate-500 text-sm italic px-1">
            {isAppAdminScope
              ? 'Aucune communauté enregistrée.'
              : 'Vous ne gérez aucun lieu pour le moment (rôle organizer ou admin sur une communauté).'}
          </p>
        )}

        {isAppAdminScope && (
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-500">Nouvelle communauté</p>
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="slug"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void createCommunity()}
            className="w-full py-1.5 rounded-lg bg-violet-600 text-white text-xs"
          >
            Créer
          </button>
        </div>
        )}
      </div>

      <div className="min-h-[320px]">
        {!selectedId && list.length > 0 && (
          <p className="text-slate-500 text-sm italic">
            {isAppAdminScope
              ? 'Sélectionnez une communauté pour modifier son profil et ses membres.'
              : 'Sélectionnez un lieu que vous administrez.'}
          </p>
        )}

        {selectedId && detailLoading && (
          <p className="text-slate-500 text-sm">Chargement du profil…</p>
        )}

        {selectedId && detailError && !detail && !detailLoading && (
          <p className="text-red-400 text-sm rounded-lg border border-red-900/50 bg-red-950/30 p-3">
            {detailError}
          </p>
        )}

        {selectedId && detail && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-3">
                <CommunityAvatar
                  avatar={editAvatar}
                  logoEmoji={editEmoji}
                  accentColor={editColor}
                  size="lg"
                />
                <span>Modifier {detail.name}</span>
              </h2>

              <div className="flex flex-wrap items-end gap-4 pb-2 border-b border-slate-800">
                <CommunityAvatar
                  avatar={editAvatar}
                  logoEmoji={editEmoji}
                  accentColor={editColor}
                  size="xl"
                />
                <div className="space-y-2">
                  <label className="block text-xs text-slate-500">
                    Photo de la communauté
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-1 block text-xs text-slate-400"
                      onChange={(e) => void onAvatarFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {editAvatar && (
                    <button
                      type="button"
                      onClick={() => setEditAvatar(null)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Retirer la photo
                    </button>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <label className="block">
                  <span className="text-slate-500 text-xs">Nom affiché</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                  />
                </label>
                {isAppAdminScope && (
                <label className="block">
                  <span className="text-slate-500 text-xs">Slug (URL)</span>
                  <input
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                  />
                </label>
                )}
                <label className="block sm:col-span-2">
                  <span className="text-slate-500 text-xs">Accroche</span>
                  <input
                    value={editTagline}
                    onChange={(e) => setEditTagline(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500 text-xs">Emoji logo</span>
                  <input
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500 text-xs">Couleur accent</span>
                  <input
                    type="color"
                    value={editColor.startsWith('#') ? editColor : '#7c3aed'}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg bg-slate-950 border border-slate-700"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-slate-500 text-xs">Description (situation, contexte)</span>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={4}
                    placeholder="Présentez le lieu, l’ambiance, ce qui se passe…"
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 resize-y"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500 text-xs">Lieu</span>
                  <input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Ville, pays…"
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500 text-xs">Site web</span>
                  <input
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    placeholder="https://…"
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-slate-500 text-xs">Contact</span>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@communaute.org"
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                  />
                </label>
              </div>

              {isAppAdminScope && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded"
                />
                Communauté active (visible dans le sélecteur)
              </label>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveCommunity()}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Membres ({members.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left p-2">Pseudo</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Rôle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.user_id} className="border-t border-slate-800">
                        <td className="p-2">{m.pseudo}</td>
                        <td className="p-2 text-slate-400">{m.email}</td>
                        <td className="p-2">
                          <select
                            value={m.role}
                            onChange={(e) => void setMemberRole(m.user_id, e.target.value)}
                            className="rounded bg-slate-950 border border-slate-700 px-1 py-0.5"
                          >
                            <option value="member">member</option>
                            <option value="organizer">organizer</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
