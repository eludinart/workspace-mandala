import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getMySkillProfile, saveMySkillProfile } from '@/lib/db-skills'
import { isSkillRegister, isSkillScope, isSkillTraitCode, type SkillTraitCode } from '@/lib/skill-constants'

export const dynamic = 'force-dynamic'

function parseBody(body: Record<string, unknown>) {
  if (!isSkillScope(body.scope)) {
    throw Object.assign(new Error('Portée invalide'), { status: 400 })
  }
  const placeIds = Array.isArray(body.place_ids)
    ? body.place_ids.map((id) => parseInt(String(id), 10)).filter((id) => id > 0)
    : []
  const tags = Array.isArray(body.tags)
    ? body.tags.flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return []
        const row = raw as { label?: unknown; register?: unknown }
        if (!isSkillRegister(row.register)) return []
        return [{ label: String(row.label ?? ''), register: row.register }]
      })
    : []
  const traits = Array.isArray(body.traits)
    ? body.traits.map(String).filter(isSkillTraitCode)
    : []
  return {
    scope: body.scope,
    offer_text: String(body.offer_text ?? ''),
    seek_text: String(body.seek_text ?? ''),
    place_ids: placeIds,
    tags,
    traits: traits as SkillTraitCode[],
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const profile = await getMySkillProfile(parseInt(userId, 10))
    return NextResponse.json({ profile })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as Record<string, unknown>
    const profile = await saveMySkillProfile(parseInt(userId, 10), parseBody(body))
    return NextResponse.json({ profile })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
