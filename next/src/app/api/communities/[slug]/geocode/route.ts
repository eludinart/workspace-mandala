import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveCommunityManagerAccess } from '@/lib/api-auth'
import { getCommunitySettingsForManager } from '@/lib/db-communities'
import { geocodeAddress } from '@/lib/geocode'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

/** Résout des coordonnées à partir d'une adresse (sans enregistrer). Gestionnaire du lieu requis. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { isAppSiteManager } = await resolveCommunityManagerAccess(uid)
    const { slug } = await ctx.params
    // Admins/gestionnaires application : accès direct. Organisateurs : droits sur le lieu requis.
    if (!isAppSiteManager) {
      await getCommunitySettingsForManager(slug, uid, false)
    }

    const body = await req.json().catch(() => ({}))
    const result = await geocodeAddress({
      address: body.address,
      postal_code: body.postal_code,
      city: body.city,
      country: body.country,
    })
    if (!result) {
      return NextResponse.json(
        { error: 'Adresse introuvable. Vérifiez les informations saisies.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ result })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
