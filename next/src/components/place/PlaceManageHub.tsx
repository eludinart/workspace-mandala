'use client'

import type { CommunityAdmin } from '@/api/admin'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { PLACE_MANAGE_ACTIONS } from '@/lib/place-manage'

export function PlaceManageHub({
  place,
  onBack,
  onNavigate,
}: {
  place: CommunityAdmin
  onBack: () => void
  onNavigate: MandalaNavigate
}) {
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-sky-400 hover:text-sky-300"
      >
        ← Mes lieux
      </button>

      <header className="flex items-start gap-4">
        <CommunityAvatar
          avatar={null}
          logoEmoji={place.logo_emoji}
          accentColor={place.accent_color}
          size="lg"
          alt={place.name}
        />
        <div className="min-w-0">
          <h2 className="text-xl font-bold truncate">{place.name}</h2>
          {place.tagline && <p className="text-sm text-slate-400 mt-0.5">{place.tagline}</p>}
          <p className="text-xs text-slate-500 mt-1">
            {place.member_count} membre{place.member_count > 1 ? 's' : ''} · {place.slug}
          </p>
        </div>
      </header>

      <p className="text-sm text-slate-400">Que souhaitez-vous administrer sur ce lieu ?</p>

      <div className="grid sm:grid-cols-2 gap-3">
        {PLACE_MANAGE_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate(action.id)}
            className="text-left rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-sky-600/40 hover:bg-sky-950/20 transition-colors"
          >
            <span className="text-xl" aria-hidden>
              {action.icon}
            </span>
            <p className="font-semibold text-sm mt-2 text-slate-100">{action.label}</p>
            <p className="text-xs text-slate-500 mt-1">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
