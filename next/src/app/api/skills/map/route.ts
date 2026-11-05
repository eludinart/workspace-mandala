import { NextRequest, NextResponse } from 'next/server'
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
    const markers = await listAnnuaireMapMarkers({ audience, communitySlug })
    return NextResponse.json({ markers })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
