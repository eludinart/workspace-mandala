import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  listAnnuaireMapMarkers,
  type AnnuaireAudience,
} from '@/lib/annuaire-map'

export const dynamic = 'force-dynamic'

function parseAudience(raw: string | null): AnnuaireAudience {
  if (raw === 'pro' || raw === 'members' || raw === 'all') return raw
  return 'all'
}

/** Marqueurs carte annuaire (villes d’exercice + lieux Mandala). */
export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ markers: [] }, { status: 503 })
    }
    const audience = parseAudience(req.nextUrl.searchParams.get('audience'))
    const communitySlug = req.nextUrl.searchParams.get('community_slug')?.trim() || null

    let viewerId = 0
    let publicAccess = true
    if (communitySlug) {
      try {
        const { userId } = await requireAuth(req)
        viewerId = parseInt(userId, 10)
        if (viewerId > 0) publicAccess = false
      } catch {
        publicAccess = true
      }
    }

    const markers = await listAnnuaireMapMarkers({
      audience,
      communitySlug,
      viewerId,
      publicAccess,
    })
    return NextResponse.json({ markers })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
