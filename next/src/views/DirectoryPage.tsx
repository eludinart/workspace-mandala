'use client'

import { useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { SkillsDirectory } from '@/components/skills/SkillsDirectory'
import { WallDiscoverSection } from '@/components/wall/WallDiscoverSection'

type DirectoryPanel = 'people' | 'places'

const DIRECTORY_PLACES_PULL_PAGES: readonly string[] = ['directory', 'places-map']

export function DirectoryPage({ onNavigate }: { onNavigate: MandalaNavigate }) {
  const [panel, setPanel] = useState<DirectoryPanel>('people')

  return (
    <div className="w-full space-y-5">
      <div
        className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5"
        role="tablist"
        aria-label="Annuaire personnes ou carte des lieux"
      >
        {(
          [
            ['people', 'Personnes'],
            ['places', 'Carte des lieux'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={panel === id}
            onClick={() => setPanel(id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${
              panel === id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {panel === 'people' ? (
        <SkillsDirectory
          peopleDirectory
          pullRefreshPage="directory"
          onOpenMessages={(userId, communitySlug) =>
            onNavigate('messages', { messagesUserId: userId, communitySlug })
          }
          onOpenConversation={(channelId) =>
            onNavigate('messages', { messagesChannelId: String(channelId) })
          }
          onOpenAlerts={() => onNavigate('notifications')}
          onEditProfile={() => onNavigate('account')}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">
                Annuaire
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-50">Carte des lieux</h2>
              <p className="text-sm text-slate-400 max-w-xl">
                Même carte que Découvrir : plein écran, liens lieux amis, fiches et Relier.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('places-map')}
              className="shrink-0 text-sm px-3 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800/80"
            >
              Ouvrir Découvrir
            </button>
          </div>
          <WallDiscoverSection
            showFeed={false}
            showPlacesList
            showRelier
            compactHeader
            pullRefreshPages={DIRECTORY_PLACES_PULL_PAGES}
            mapHeightClass="h-[min(40vh,16rem)] sm:h-[min(52vh,28rem)]"
          />
        </div>
      )}
    </div>
  )
}
