import { NextRequest, NextResponse } from 'next/server'
import { getCommunityBySlug } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'
import { listSkillDirectory } from '@/lib/db-skills'

export const dynamic = 'force-dynamic'

/** Annuaire public : uniquement les fiches ouvertes à tout Mandala. */
export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ cards: [] }, { status: 503 })
    }
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim() ?? ''
    let communityId: number | null = null
    if (slug) {
      const community = await getCommunityBySlug(slug)
      if (!community) return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
      communityId = community.id
    }
    const cards = await listSkillDirectory({
      viewerId: 0,
      view: slug ? 'place' : 'mandala',
      communityId,
      query: req.nextUrl.searchParams.get('q') ?? '',
      tag: req.nextUrl.searchParams.get('tag') ?? '',
      publicAccess: true,
    })
    return NextResponse.json({
      cards: cards.map((card) => ({ ...card, is_me: false })),
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
