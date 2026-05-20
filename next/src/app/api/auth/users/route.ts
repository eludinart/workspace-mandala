import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { listUsersAdmin } from '@/lib/db-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ items: [], total: 0 })
    }
    await requireAdmin(req)
    const search = req.nextUrl.searchParams.get('search') ?? ''
    const role = req.nextUrl.searchParams.get('role') ?? ''
    const res = await listUsersAdmin({ search, role })
    return NextResponse.json(res)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur', items: [], total: 0 },
      { status: e.status ?? 401 }
    )
  }
}
