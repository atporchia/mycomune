import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { fetchOpenPNRR } from '@/lib/ingest/openpnrr'
import { upsertProjects, rebuildComuniAggregates } from '@/lib/db/projects'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [logRow] = await sql`
    INSERT INTO ingestion_logs (source, status)
    VALUES ('openpnrr', 'running')
    RETURNING id
  `

  if (!logRow) {
    return NextResponse.json({ error: 'Failed to create ingestion log' }, { status: 500 })
  }

  const logId: string = logRow.id
  const startedAt = Date.now()

  try {
    const { records, rawRowCount, skipped, sourceUrl, declaredUpdateDate } =
      await fetchOpenPNRR()

    const { updated } = await upsertProjects(records)

    await rebuildComuniAggregates()

    await sql`
      UPDATE source_metadata SET
        last_checked_at      = NOW(),
        last_available_at    = NOW(),
        declared_update_date = ${declaredUpdateDate},
        is_available         = true,
        notes                = ${'Last ingest: ' + rawRowCount + ' rows fetched'}
      WHERE source_name = 'openpnrr'
    `

    await sql`
      UPDATE ingestion_logs SET
        completed_at    = NOW(),
        status          = 'success',
        records_fetched = ${rawRowCount},
        records_new     = 0,
        records_updated = ${updated},
        records_removed = 0
      WHERE id = ${logId}
    `

    const duration = ((Date.now() - startedAt) / 1000).toFixed(1)

    return NextResponse.json({
      ok:         true,
      source:     'openpnrr',
      source_url: sourceUrl,
      raw_rows:   rawRowCount,
      normalized: records.length,
      skipped,
      upserted:   updated,
      duration_s: parseFloat(duration),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    await sql`
      UPDATE ingestion_logs SET
        completed_at  = NOW(),
        status        = 'failure',
        error_message = ${message}
      WHERE id = ${logId}
    `

    await sql`
      UPDATE source_metadata SET
        last_checked_at = NOW(),
        is_available    = false,
        notes           = ${'Ingest error: ' + message}
      WHERE source_name = 'openpnrr'
    `

    console.error('[ingest] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
