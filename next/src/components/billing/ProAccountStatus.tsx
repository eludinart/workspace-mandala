'use client'

import { useEffect, useState } from 'react'
import { skillsApi } from '@/api/skills'
import type { MandalaNavigate } from '@/components/MandalaApp'

/** Statut Mandala Pro + vues fiche (Compte → Abonnements). */
export function ProAccountStatus({
  onNavigate,
}: {
  onNavigate?: MandalaNavigate
}) {
  const [stats, setStats] = useState<{
    views_30d: number
    verification: string
    endorsement_place_name: string | null
    pro_status: string
    reject_reason: string | null
  } | null>(null)

  useEffect(() => {
    void skillsApi
      .stats()
      .then((s) =>
        setStats({
          views_30d: s.views_30d,
          verification: s.verification,
          endorsement_place_name: s.endorsement_place_name,
          pro_status: s.pro_status,
          reject_reason: s.reject_reason,
        })
      )
      .catch(() => setStats(null))
  }, [])

  if (!stats || stats.pro_status === 'none') {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        Mandala Pro : boost dans l’annuaire, badge endossé par un lieu, contact
        facilité. Différent d’un annuaire gratuit : vous êtes trouvé via des
        communautés vivantes.
      </p>
    )
  }

  const verifLabel =
    stats.verification === 'verified'
      ? stats.endorsement_place_name
        ? `Badge endossé par ${stats.endorsement_place_name}`
        : 'Badge vérifié'
      : stats.verification === 'pending'
        ? 'Endossement en attente'
        : stats.verification === 'rejected'
          ? 'Endossement refusé'
          : 'Pas encore de demande d’endossement'

  return (
    <div className="rounded-lg border border-violet-800/40 bg-violet-950/20 px-3 py-2 space-y-1 text-xs text-slate-300">
      <p className="font-medium text-violet-100">
        Mandala Pro · {stats.pro_status}
      </p>
      <p>{verifLabel}</p>
      {stats.verification === 'rejected' && stats.reject_reason && (
        <p className="text-rose-300">{stats.reject_reason}</p>
      )}
      <p>
        {stats.views_30d} vue{stats.views_30d > 1 ? 's' : ''} de fiche (30 j)
      </p>
      {onNavigate && (
        <button
          type="button"
          className="underline underline-offset-2 text-violet-200"
          onClick={() => onNavigate('billing-offers')}
        >
          Mettre à jour la demande d’endossement
        </button>
      )}
      <p className="text-slate-500">
        Fiche compétences : onglet Compétences (préremplie après soumission Pro).
      </p>
    </div>
  )
}
