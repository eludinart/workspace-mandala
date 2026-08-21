import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getCalendarDayDetail } from '@/lib/db-calendar'
import { getCircleSession } from '@/lib/db-circle-journal'
import { listPlaceListItems } from '@/lib/db-place-lists'
import { requirePlaceOpsAccess } from '@/lib/preview-ops-access'

export const dynamic = 'force-dynamic'

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function assertDay(day: string): string {
  const d = String(day ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw Object.assign(new Error('Jour invalide (YYYY-MM-DD)'), { status: 400 })
  }
  return d
}

/** Vie du lieu (accueil) — présence, événements, courses/logistique, cercles. */
export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const community_slug = String(req.nextUrl.searchParams.get('community_slug') ?? '').trim()
    const dayParam = req.nextUrl.searchParams.get('day')
    const day = dayParam ? assertDay(dayParam) : todayYmd()

    const { uid, communityId, canManage } = await requirePlaceOpsAccess(req, {
      communitySlug: community_slug || null,
    })

    const [cal, coursesAll, logisticsAll, circleMorning, circleEvening] = await Promise.all([
      getCalendarDayDetail({ communityId, day, viewerUserId: uid }),
      listPlaceListItems({ communityId, kind: 'courses', view: 'active' }).catch(() => []),
      listPlaceListItems({ communityId, kind: 'logistics', view: 'active' }).catch(() => []),
      getCircleSession({ communityId, day, slot: 'morning' }).catch(() => null),
      getCircleSession({ communityId, day, slot: 'evening' }).catch(() => null),
    ])

    const mapListItem = (i: (typeof coursesAll)[number], forDay: boolean) => ({
      id: i.id,
      title: i.title,
      notes: i.notes,
      bring_date: i.bring_date,
      claimed_by_pseudo: i.claimed_by_pseudo,
      claims: i.claims,
      photo_count: i.photos?.length ?? 0,
      for_today: forDay,
    })

    const isForToday = (i: (typeof coursesAll)[number]) =>
      i.bring_date === day || !!i.claims?.some((c) => c.bring_date === day)

    // Résumé des listes en cours — items du jour en premier
    const sortActive = (items: typeof coursesAll) =>
      [...items].sort((a, b) => {
        const at = isForToday(a) ? 0 : 1
        const bt = isForToday(b) ? 0 : 1
        if (at !== bt) return at - bt
        return (a.bring_date || '9999').localeCompare(b.bring_date || '9999')
      })

    const courses = sortActive(coursesAll)
      .slice(0, 8)
      .map((i) => mapListItem(i, isForToday(i)))
    const logistics = sortActive(logisticsAll)
      .slice(0, 8)
      .map((i) => mapListItem(i, isForToday(i)))

    const presentUsers = cal.detail.present_users
    const iAmPresent = presentUsers.some((u) => u.user_id === uid)

    const mapCircle = (s: Awaited<ReturnType<typeof getCircleSession>>) =>
      s
        ? {
            id: s.id,
            slot: s.slot,
            title: s.title,
            summary: s.summary,
            has_image: !!(s.image_data && s.image_data.length > 0),
            created_by_pseudo: s.created_by_pseudo,
          }
        : null

    return NextResponse.json({
      day,
      community_id: communityId,
      can_manage: canManage,
      presence: {
        is_disabled: cal.detail.is_disabled,
        max_participants: cal.detail.max_participants,
        present_count: presentUsers.length,
        i_am_present: iAmPresent,
        present_users: presentUsers.slice(0, 12),
        show_presence: cal.settings.show_presence,
      },
      events: cal.detail.events,
      courses,
      logistics,
      courses_open_count: coursesAll.length,
      logistics_open_count: logisticsAll.length,
      courses_today_count: coursesAll.filter(isForToday).length,
      logistics_today_count: logisticsAll.filter(isForToday).length,
      circles: {
        morning: mapCircle(circleMorning),
        evening: mapCircle(circleEvening),
      },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
