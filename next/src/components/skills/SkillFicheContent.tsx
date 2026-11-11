'use client'

import type { SkillCard } from '@/api/skills'
import { MeetRequestButton } from '@/components/directory/MeetRequestButton'
import { ReturnsBlock } from '@/components/returns/ReturnsBlock'
import { UserAvatar } from '@/components/UserAvatar'
import { MandalaProBadge } from '@/components/pro/MandalaProBadge'
import { SkillFicheShare } from '@/components/skills/SkillFicheShare'
import { MemberGalleryRail } from '@/components/members/MemberGalleryRail'
import { publicPlaceProfileHref } from '@/lib/skill-place-link'
import { RESOURCE_KINDS } from '@/lib/resource-constants'
import { SKILL_REGISTER_LABELS } from '@/lib/skill-constants'

function resourceKindLabel(kind: string): string {
  return RESOURCE_KINDS.find((item) => item.id === kind)?.label ?? 'Ressource'
}

type ProseBlock = { title: string | null; body: string }

function skillProseBlocks(text: string): ProseBlock[] {
  const pieces = text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((piece) =>
      piece
        .split(/(?<=\.)\)?\s+(?=[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇŒÆ][^:\n]{2,80} : )/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  return pieces.map((piece) => {
    const m = piece.match(/^([^:\n]{2,80}) :\s*([\s\S]+)$/)
    if (m) return { title: m[1].trim(), body: m[2].trim() }
    return { title: null, body: piece }
  })
}

function SkillProse({ text }: { text: string }) {
  return (
    <div className="space-y-4">
      {skillProseBlocks(text).map((block, i) => (
        <div key={i} className="space-y-1">
          {block.title && (
            <p className="text-sm font-medium text-slate-200">{block.title}</p>
          )}
          <p className="text-[15px] leading-7 text-slate-300 whitespace-pre-wrap max-w-[68ch]">
            {block.body}
          </p>
        </div>
      ))}
    </div>
  )
}

export function SkillFicheContent({
  selected,
  variant,
  communitySlug,
  onContact,
  onOpenConversation,
  onOpenAlerts,
}: {
  selected: SkillCard
  variant: 'app' | 'public'
  communitySlug?: string
  onContact?: (card: SkillCard) => void
  onOpenConversation?: (channelId: number) => void
  onOpenAlerts?: () => void
}) {
  return (
    <div className="space-y-7">
      <header className="flex items-start gap-4">
        <UserAvatar
          avatar={selected.avatar}
          avatarEmoji={selected.avatar_emoji}
          size="xl"
          alt={selected.pseudo}
        />
        <div className="min-w-0 pt-1">
          <h3 className="text-2xl font-semibold text-slate-50 leading-tight flex flex-wrap items-center gap-2">
            <span>{selected.display_name || selected.pseudo}</span>
            {selected.pro_verified ? (
              <MandalaProBadge endorsementPlace={selected.pro_endorsement_place} />
            ) : selected.pro_boost ? (
              <MandalaProBadge variant="boost" />
            ) : null}
          </h3>
          {selected.pro_tagline && (
            <p className="mt-1 text-sm text-slate-200">{selected.pro_tagline}</p>
          )}
          {selected.skills_visible !== false && selected.scope === 'mandala' && (
            <p className="mt-1 text-xs font-medium text-violet-300">Visible sur Mandala</p>
          )}
          {selected.places.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {selected.places.map((p) => {
                const href = publicPlaceProfileHref(p)
                const label = (
                  <>
                    <span aria-hidden>{p.logo_emoji || '🏛️'}</span>
                    <span>
                      Rattaché au lieu Mandala · <strong>{p.name}</strong>
                    </span>
                  </>
                )
                const className =
                  'inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-950/35 px-2.5 py-1 text-xs text-amber-100'
                return (
                  <li key={p.id}>
                    {href ? (
                      <a href={href} className={`${className} hover:bg-amber-900/40`}>
                        {label}
                      </a>
                    ) : (
                      <span className={className} title="Profil du lieu privé">
                        {label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Sans rattachement à un lieu Mandala</p>
          )}
          {selected.residence_city && (
            <p className="mt-1.5 text-xs text-emerald-300/90">Habite à {selected.residence_city}</p>
          )}
          {(selected.practice_locations?.length ?? 0) > 0 && (
            <p className="mt-1.5 text-xs text-sky-300/90">
              Exerce à {(selected.practice_locations ?? []).join(' · ')}
            </p>
          )}
          {selected.is_me && selected.profile_views_30d != null && (
            <p className="mt-1 text-xs text-slate-400">
              {selected.profile_views_30d} vue
              {selected.profile_views_30d > 1 ? 's' : ''} de fiche sur 30 jours
            </p>
          )}
          {(selected.is_me || selected.scope === 'mandala') && (
            <SkillFicheShare
              userId={selected.user_id}
              displayName={selected.display_name || selected.pseudo}
              shareTitle={selected.is_me ? 'Ma fiche Mandala' : undefined}
              canSharePublic={selected.scope === 'mandala'}
              alwaysShow={selected.is_me}
              compact
            />
          )}
        </div>
      </header>

      {(selected.gallery_images?.length ?? 0) > 0 && (
        <MemberGalleryRail images={selected.gallery_images ?? []} label="Ambiance / activité" />
      )}

      {(selected.pro_modalities || selected.pro_service_area || selected.pro_external_url) && (
        <section className="space-y-1 rounded-xl border border-violet-900/40 bg-violet-950/20 px-4 py-3 text-sm text-slate-300">
          {selected.pro_service_area && <p>Zone : {selected.pro_service_area}</p>}
          {selected.pro_modalities && <p>{selected.pro_modalities}</p>}
          {selected.pro_external_url && (
            <a
              href={selected.pro_external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 underline underline-offset-2"
            >
              Site / prise de rendez-vous
            </a>
          )}
        </section>
      )}

      {!!selected.bio?.trim() && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bio</h4>
          <p className="text-[15px] leading-7 text-slate-300 whitespace-pre-wrap max-w-[68ch]">
            {selected.bio.trim()}
          </p>
        </section>
      )}

      {selected.skills_visible !== false && selected.tags.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Savoir-faire
          </h4>
          <ul className="flex min-w-0 flex-wrap gap-2">
            {selected.tags.map((t) => (
              <li
                key={`${t.label}-${t.register}`}
                className="max-w-full rounded-2xl border border-slate-700 bg-slate-950/40 px-3 py-2"
              >
                <p className="text-sm text-slate-100 break-words">{t.label}</p>
                <p className="text-[11px] text-slate-500">{SKILL_REGISTER_LABELS[t.register]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected.skills_visible !== false && selected.offer_text && (
        <section className="space-y-3 border-t border-slate-800 pt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ce que je peux apporter
          </h4>
          <SkillProse text={selected.offer_text} />
        </section>
      )}

      {selected.skills_visible !== false && selected.seek_text && (
        <section className="space-y-3 border-t border-slate-800 pt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ce que je cherche
          </h4>
          <SkillProse text={selected.seek_text} />
        </section>
      )}

      {selected.skills_visible !== false && selected.frame_text && (
        <section className="space-y-3 border-t border-slate-800 pt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mon cadre</h4>
          <SkillProse text={selected.frame_text} />
        </section>
      )}

      <div className="border-t border-slate-800 pt-6">
        <ReturnsBlock
          key={selected.user_id}
          mode="person"
          userId={selected.user_id}
          communitySlug={communitySlug || selected.shared_place_slug || undefined}
          compact
          heading="Retours"
          allowDesignate={!selected.is_me}
        />
      </div>

      {(selected.resources?.length ?? 0) > 0 && (
        <section className="space-y-3 border-t border-slate-800 pt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ressources</h4>
          <ul className="space-y-2">
            {selected.resources!.map((resource) => (
              <li
                key={resource.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3"
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {resourceKindLabel(resource.kind)}
                </p>
                <p className="text-sm font-medium text-slate-100">{resource.title}</p>
                {resource.summary && (
                  <p className="mt-1 text-sm leading-6 text-slate-400">{resource.summary}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!selected.bio?.trim() &&
        selected.skills_visible === false &&
        (selected.resources?.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500">
            Cette personne n’a pas encore partagé sa bio, ses compétences ni ses ressources.
          </p>
        )}

      {variant === 'app' && !selected.is_me && (
        <div className="flex flex-wrap gap-2">
          {(selected.shares_place || selected.pro_verified) && onContact && (
            <button
              type="button"
              onClick={() => onContact(selected)}
              className="text-sm px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
            >
              {selected.pro_verified && !selected.shares_place
                ? 'Contacter (Mandala Pro)'
                : 'Envoyer un message'}
            </button>
          )}
          {!selected.shares_place && (
            <MeetRequestButton
              userId={selected.user_id}
              onOpenConversation={onOpenConversation}
              onOpenAlerts={onOpenAlerts}
            />
          )}
        </div>
      )}
      {variant === 'public' && (
        <a
          href="/app"
          className="inline-block text-sm px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
        >
          Se connecter pour écrire
        </a>
      )}
    </div>
  )
}
