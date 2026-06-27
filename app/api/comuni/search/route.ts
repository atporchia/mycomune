import type { NextRequest } from 'next/server'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) {
    return Response.json({ comuni: [] })
  }

  try {
    const comuni = await sql`
      SELECT nome, province, region, total_projects, total_funding
      FROM comuni
      WHERE nome ILIKE ${'%' + q + '%'}
      ORDER BY total_funding DESC NULLS LAST
      LIMIT 10
    `
    return Response.json({ comuni })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
