import { notFound } from 'next/navigation'
import Link from 'next/link'
import sql from '@/lib/db'
import { toTitleCase, formatEur, formatDate } from '@/lib/format'
import FreshnessBadge from '@/app/components/FreshnessBadge'

const PAGE_SIZE = 20

const WATCH_SIGNAL_OPTIONS = [
  'high-value project',
  'missing expected completion date',
  'missing implementing entity',
  'unclear description',
  'generic title',
]

export default async function ProgettiPage({
  params,
  searchParams,
}: {
  params: Promise<{ comune: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { comune: comuneSlug } = await params
  const filters = await searchParams

  const comuneName = decodeURIComponent(comuneSlug)

  const q        = String(filters.q        ?? '')
  const categoria = String(filters.categoria ?? '')
  const segnale  = String(filters.segnale  ?? '')
  const pagina   = Math.max(1, parseInt(String(filters.pagina ?? '1'), 10))
  const from     = (pagina - 1) * PAGE_SIZE

  const comune = await sql`
    SELECT nome, province, region, total_projects, last_watchdog_check, official_source_last_update
    FROM comuni
    WHERE nome ILIKE ${comuneName}
    LIMIT 1
  `.then(r => r[0] ?? null)

  if (!comune) notFound()

  // Build dynamic WHERE conditions
  const conditions = [sql`comune ILIKE ${comuneName}`]
  if (q)        conditions.push(sql`title ILIKE ${'%' + q + '%'}`)
  if (categoria) conditions.push(sql`category ILIKE ${'%' + categoria + '%'}`)
  if (segnale)  conditions.push(sql`${segnale} = ANY(watch_signals)`)

  const where = conditions.reduce((a, b) => sql`${a} AND ${b}`)

  const [projects, [{ count }]] = await Promise.all([
    sql`
      SELECT id, title, amount_total, category, mission, implementing_entity,
             comune, watch_signals, last_seen_at
      FROM projects
      WHERE ${where}
      ORDER BY amount_total DESC NULLS LAST
      LIMIT ${PAGE_SIZE} OFFSET ${from}
    `,
    sql`SELECT COUNT(*) as count FROM projects WHERE ${where}`,
  ])

  const total      = Number(count)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(overrides: Record<string, string | undefined>) {
    const merged = { q, categoria, segnale, pagina: String(pagina), ...overrides }
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v)
    }
    const qs = p.toString()
    return `/${comuneSlug}/progetti${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex gap-3 text-sm text-emerald-600">
        <Link href="/" className="hover:underline">← Home</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/${comuneSlug}`} className="hover:underline">
          {toTitleCase(comune.nome)}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500">Progetti</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Progetti PNRR — {toTitleCase(comune.nome)}
      </h1>
      <p className="text-sm text-gray-400 mb-8">
        {comune.province}{comune.region ? ` · ${comune.region}` : ''}
      </p>

      {/* Filters */}
      <form method="GET" className="mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-gray-500 mb-1">Parola chiave</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Cerca per titolo..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <div className="min-w-40">
          <label className="block text-xs text-gray-500 mb-1">Categoria</label>
          <input
            name="categoria"
            defaultValue={categoria}
            placeholder="Es. Digitalizzazione"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <div className="min-w-52">
          <label className="block text-xs text-gray-500 mb-1">Segnale</label>
          <select
            name="segnale"
            defaultValue={segnale}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="">Tutti</option>
            {WATCH_SIGNAL_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Filtra
          </button>
          {(q || categoria || segnale) && (
            <Link
              href={`/${comuneSlug}/progetti`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Azzera
            </Link>
          )}
        </div>
      </form>

      {/* Count */}
      <p className="text-xs text-gray-400 mb-4">
        {total === 0
          ? 'Nessun progetto trovato.'
          : `${total.toLocaleString('it-IT')} progett${total === 1 ? 'o' : 'i'} trovato${total === 1 ? '' : 'i'}${q || categoria || segnale ? ' con i filtri applicati' : ''}.`}
      </p>

      {/* Project list */}
      {projects.length > 0 ? (
        <div className="space-y-2 mb-8">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/${comuneSlug}/progetti/${p.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.category ?? p.mission ?? 'N/D'}
                  {p.implementing_entity ? ` · ${p.implementing_entity}` : ''}
                </p>
                {p.watch_signals && p.watch_signals.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.watch_signals.map((s: string) => (
                      <span
                        key={s}
                        className="inline-block rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-4 shrink-0 text-right">
                <p className="text-sm font-semibold text-emerald-700">{formatEur(p.amount_total)}</p>
                {p.last_seen_at && (
                  <p className="text-xs text-gray-300 mt-0.5">{formatDate(p.last_seen_at)}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-sm text-gray-400">
          Nessun progetto corrisponde ai filtri selezionati.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mb-10">
          {pagina > 1 && (
            <Link
              href={buildUrl({ pagina: String(pagina - 1) })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Precedente
            </Link>
          )}
          <span className="text-xs text-gray-400">
            Pagina {pagina} di {totalPages}
          </span>
          {pagina < totalPages && (
            <Link
              href={buildUrl({ pagina: String(pagina + 1) })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Successiva →
            </Link>
          )}
        </div>
      )}

      <FreshnessBadge
        watchdogCheck={comune.last_watchdog_check}
        officialUpdate={comune.official_source_last_update}
        sourceUrl="https://openpnrr.it"
      />
    </main>
  )
}
