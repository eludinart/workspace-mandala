'use client'

import { useEffect, useState } from 'react'
import { communitiesApi, type MemberCharterView } from '@/api/communities'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { CharterPreview } from '@/components/place/CharterEditor'

type Props = {
  slug: string
  initial?: MemberCharterView | null
  onAccepted: () => void
}

export function CharterAcceptanceScreen({ slug, initial, onAccepted }: Props) {
  const [data, setData] = useState<MemberCharterView | null>(initial ?? null)
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState<string | null>(null)
  const [readChecked, setReadChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initial) {
      if (!initial.requires_acceptance) {
        onAccepted()
      }
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void communitiesApi
      .getCharter(slug)
      .then((res) => {
        if (cancelled) return
        setData(res.charter)
        if (!res.charter.requires_acceptance) {
          onAccepted()
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError((err as { message?: string })?.message ?? 'Impossible de charger la charte.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, initial, onAccepted])

  if (loading && !data) {
    return (
      <div className="w-full max-w-2xl text-center py-16">
        <p className="text-sm text-slate-400">Chargement de la charte…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="w-full max-w-2xl text-center space-y-4 py-12">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setError(null)
            void communitiesApi
              .getCharter(slug)
              .then((res) => setData(res.charter))
              .catch((err: unknown) =>
                setError((err as { message?: string })?.message ?? 'Impossible de charger la charte.')
              )
              .finally(() => setLoading(false))
          }}
          className="text-sm px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (!data) return null

  async function accept() {
    if (!readChecked) return
    setSubmitting(true)
    setError(null)
    try {
      await communitiesApi.acceptCharter(slug)
      onAccepted()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Validation impossible.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-2xl flex flex-col max-h-[min(92vh,48rem)]">
      <header className="shrink-0 text-center space-y-3 pb-4 border-b border-slate-800">
        <p className="text-xs uppercase tracking-widest text-violet-400/90">Bienvenue</p>
        <div className="flex flex-col items-center gap-2">
          <CommunityAvatar
            avatar={data.avatar}
            logoEmoji={data.logo_emoji}
            accentColor={data.accent_color}
            size="lg"
            alt={data.name}
          />
          <h1 className="text-xl font-bold">Charte — {data.name}</h1>
          {data.tagline && <p className="text-sm text-slate-400">{data.tagline}</p>}
        </div>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Avant d&apos;accéder à l&apos;espace du lieu, merci de lire la charte ci-dessous et de
          confirmer votre engagement.
        </p>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto py-5 px-1">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5">
          <CharterPreview blocks={data.charter} />
        </div>
      </div>

      <footer className="shrink-0 pt-4 border-t border-slate-800 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-300">
          <input
            type="checkbox"
            checked={readChecked}
            onChange={(e) => setReadChecked(e.target.checked)}
            className="mt-1 rounded border-slate-600"
          />
          <span>J&apos;ai lu la charte du lieu et je m&apos;engage à la respecter.</span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          disabled={!readChecked || submitting}
          onClick={() => void accept()}
          className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3 font-semibold disabled:opacity-50"
        >
          {submitting ? '…' : 'Valider et accéder au lieu'}
        </button>
      </footer>
    </div>
  )
}
