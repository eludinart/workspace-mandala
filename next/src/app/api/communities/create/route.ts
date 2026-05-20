import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createCommunity } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json()
    const community = await createCommunity({
      slug: String(body.slug ?? ''),
      name: String(body.name ?? ''),
      tagline: body.tagline != null ? String(body.tagline) : undefined,
      accent_color: body.accent_color != null ? String(body.accent_color) : undefined,
      logo_emoji: body.logo_emoji != null ? String(body.logo_emoji) : undefined,
      creatorUserId: uid,
    })
    return NextResponse.json({ community })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
