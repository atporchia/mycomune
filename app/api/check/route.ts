import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

const SOURCES = [
  { name: 'openpnrr',     url: process.env.OPENPNRR_CSV_URL || 'https://openpnrr.s3.amazonaws.com/media/progetti.csv' },
  { name: 'italiadomani', url: 'https://italiadomani.gov.it/it/Interventi/open-data.html' },
]

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results: Record<string, { available: boolean; status?: number; error?: string }> = {}

  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(15_000),
      })
      const available = res.ok

      await sql`
        UPDATE source_metadata SET
          last_checked_at   = ${now},
          last_available_at = ${available ? now : null},
          is_available      = ${available}
        WHERE source_name = ${source.name}
      `

      results[source.name] = { available, status: res.status }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)

      await sql`
        UPDATE source_metadata SET
          last_checked_at = ${now},
          is_available    = false,
          notes           = ${'Check error: ' + message}
        WHERE source_name = ${source.name}
      `

      results[source.name] = { available: false, error: message }
    }
  }

  return NextResponse.json({ ok: true, checked_at: now.toISOString(), results })
}
