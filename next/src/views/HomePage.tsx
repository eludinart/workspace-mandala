'use client'

import type { MandalaPage } from '@/components/MandalaApp'
import { useCommunity } from '@/contexts/CommunityContext'

export function HomePage({ onNavigate }: { onNavigate: (p: MandalaPage) => void }) {
  const { active } = useCommunity()
  const accent = active?.accent_color ?? '#7c3aed'

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="text-sm text-slate-400">Bienvenue sur</p>
        <h1 className="text-3xl font-bold mt-1" style={{ color: accent }}>
          {active?.logo_emoji} {active?.name ?? 'Mandala'}
        </h1>
        {active?.tagline && <p className="text-slate-400 mt-2">{active.tagline}</p>}
      </header>

      <p className="text-slate-300 leading-relaxed">
        Un même espace pour vos lieux, vos groupes et vos événements. Shambhala, Sivanà et les
        autres communautés coexistent ici — choisissez la vôtre dans le menu.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card
          title="Événements"
          desc="Préparation, jour J, bilan — bientôt détaillé par communauté."
          onClick={() => onNavigate('events')}
        />
        <Card
          title="Membres"
          desc="Découvrir qui fait partie de la communauté active."
          onClick={() => onNavigate('members')}
        />
        <Card title="Messages" desc="Échanges entre membres." onClick={() => onNavigate('messages')} />
      </div>
    </div>
  )
}

function Card({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-violet-500/50 transition-colors"
    >
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
    </button>
  )
}
