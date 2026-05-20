import { NextResponse } from 'next/server'

/** Sonde légère pour Docker/Coolify (sans accès base de données). */
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: true, live: true })
}
