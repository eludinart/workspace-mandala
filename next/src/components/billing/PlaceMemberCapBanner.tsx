'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { billingApi } from '@/api/billing'
import type { PlaceMemberCapState } from '@/lib/billing-entitlements'

type CapSnapshot = {
  enforced: boolean
  limit: number | null
  softAt: number | null
  count: number
  state: PlaceMemberCapState
}

function parseCap(raw: Record<string, unknown> | undefined): CapSnapshot | null {
  if (!raw) return null
  const nested = (raw.memberCap ?? raw.member_cap) as Record<string, unknown> | undefined
  if (!nested || typeof nested !== 'object') return null
  const stateRaw = String(nested.state ?? 'ok')
  const state: PlaceMemberCapState =
    stateRaw === 'soft' || stateRaw === 'hard' ? stateRaw : 'ok'
  return {
    enforced: Boolean(nested.enforced),
    limit:
      nested.limit != null && Number.isFinite(Number(nested.limit))
        ? Number(nested.limit)
        : null,
    softAt:
      nested.softAt != null && Number.isFinite(Number(nested.softAt))
        ? Number(nested.softAt)
        : nested.soft_at != null && Number.isFinite(Number(nested.soft_at))
          ? Number(nested.soft_at)
          : null,
    count: Number(nested.count ?? 0) || 0,
    state,
  }
}

/**
 * Bandeau soft (80 %) / hard (plafond) pour gestionnaires — freemium lieu.
 * Invisible si porte billing fermée, lieu abonné, ou sous le seuil soft.
 */
export function PlaceMemberCapBanner({
  communityId,
  className = '',
}: {
  communityId: number
  className?: string
}) {
  const [cap, setCap] = useState<CapSnapshot | null>(null)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    ;(async () => {
      try {
        const access = await billingApi.getAccess()
        if (cancelled) return
        const place = (access.places ?? []).find((p) => {
          const id = Number(p.communityId ?? p.community_id)
          return id === communityId
        })
        setCap(parseCap(place as Record<string, unknown> | undefined))
      } catch {
        if (!cancelled) setCap(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [communityId])

  if (!cap?.enforced || cap.state === 'ok') return null

  const limit = cap.limit ?? 40
  const softAt = cap.softAt ?? 32
  const hard = cap.state === 'hard'
  const tone = hard
    ? 'border-rose-800/50 bg-rose-950/30 text-rose-100'
    : 'border-amber-800/50 bg-amber-950/25 text-amber-100'

  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 text-sm space-y-1.5 ${tone} ${className}`}
    >
      <p className="font-medium">
        {hard
          ? `Limite gratuite atteinte (${cap.count}/${limit} membres)`
          : `Votre lieu approche de la limite gratuite (${cap.count}/${limit})`}
      </p>
      <p className="text-xs opacity-90 leading-relaxed">
        {hard
          ? 'Les nouvelles adhésions sont bloquées. L’offre Lieu lève le plafond et active la carte publique. Les membres déjà présents gardent mur, messages et événements.'
          : `À partir de ${softAt} membres, pensez à l’offre Lieu : plafond illimité et présence sur la carte publique.`}
      </p>
      <p className="text-xs pt-0.5">
        <Link href="/app#offres" className="underline underline-offset-2 hover:opacity-90">
          Voir l’offre Lieu
        </Link>
      </p>
    </div>
  )
}
