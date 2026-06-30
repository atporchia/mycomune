import Link from 'next/link'
import sql from '@/lib/db'
import { formatEur, formatDate } from '@/lib/format'

const PAGE_SIZE = 20

const CATEGORY_OPTIONS = [
  'agricoltura',
  'startup',
  'pmi',
  'innovazione',
  'digitale',
  'sostenibilità',
  'giovani',
  'formazione',
  'internazionalizzazione',
  'ue',
]

const REGION_OPTIONS = [
  'Abruzzo',
  'Basilicata',
  'Calabria',
  'Campania',
  'Emilia-Romagna',
  'Friuli-Venezia Giulia',
  'Lazio',
  'Liguria',
  'Lombardia',
  'Marche',
  'Molise',
  'Piemonte',
  'Puglia',
  'Sardegna',
  'Sicilia',
  'Toscana',
  'Trentino-Alto Adige',
  'Umbria',
  "Valle d'Aosta",
  'Veneto',
]

export default async function BandiPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const filters = await searchParams
  const q       = String(filters.q       ?? '')
  const cat     = String(filters.cat     ?? '')
  const regione = String(filters.regione ?? '')
  const pagina  = Math.max(1, parseInt(String(filters.pagina ?? '1'), 10))
  const from    = (pagina - 1) * PAGE_SIZE

  // When a region is selected, show calls for that region AND calls with no region restriction
  const [calls, [{ count }]] = await Promise.all([
    sql`
      SELECT id, title, program, categories, regions, deadline, budget_total, description
      FROM funding_calls
      WHERE status = 'open'
        ${q       ? sql`AND (title ILIKE ${'%' + q + '%'} OR description ILIKE ${'%' + q + '%'})` : sql``}
        ${cat     ? sql`AND categories @> ${[cat]}`     : sql``}
        ${regione ? sql`AND regions    @> ${[regione]}` : sql``}
      ORDER BY deadline ASC NULLS LAST, title ASC
      LIMIT ${PAGE_SIZE} OFFSET ${from}
    `,
    sql`
      SELECT COUNT(*) as count
      FROM funding_calls
      WHERE status = 'open'
        ${q       ? sql`AND (title ILIKE ${'%' + q + '%'} OR description ILIKE ${'%' + q + '%'})` : sql``}
        ${cat     ? sql`AND categories @> ${[cat]}`     : sql``}
        ${regione ? sql`AND regions    @> ${[regione]}` : sql``}
    `,
  ])

  const total      = Number(count)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(overrides: Record<string, string | undefined>) {
    const merged = { q, cat, regione, pagina: String(pagina), ...overrides }
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v)
    }
    const qs = p.toString()
    return `/bandi${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1">
          Finanziamenti disponibili
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bandi Aperti</h1>
        <p className="text-sm text-gray-500 max-w-2xl">
          Fondi pubblici italiani ed europei a cui privati, imprenditori, agricoltori e
          aziende possono candidarsi. Diversi dai progetti PNRR già assegnati: qui puoi
          trovare risorse ancora disponibili per te.
        </p>
      </div>

      {/* Search + filter */}
      <form method="GET" className="mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-52">
          <label className="block text-xs text-gray-500 mb-1">Cerca per parola chiave</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="es. agricoltura, startup, energia..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <div className="min-w-44">
          <label className="block text-xs text-gray-500 mb-1">Categoria</label>
          <select
            name="cat"
            defaultValue={cat}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="">Tutte</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="min-w-44">
          <label className="block text-xs text-gray-500 mb-1">Regione</label>
          <select
            name="regione"
            defaultValue={regione}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="">Tutta Italia</option>
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
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
          {(q || cat || regione) && (
            <Link
              href="/bandi"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Azzera
            </Link>
          )}
        </div>
      </form>

      <p className="text-xs text-gray-400 mb-5">
        {total === 0
          ? 'Nessun bando trovato.'
          : `${total} band${total === 1 ? 'o' : 'i'} aper${total === 1 ? 'to' : 'ti'}${q || cat || regione ? ' con i filtri applicati' : ''}.`}
      </p>

      {/* Call list */}
      {calls.length > 0 ? (
        <div className="space-y-3 mb-8">
          {calls.map((c) => (
            <Link
              key={c.id}
              href={`/bandi/${c.id}`}
              className="block rounded-xl border border-gray-100 bg-white px-5 py-4 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {/* Program badge */}
                  {c.program && (
                    <span className="inline-block mb-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      {c.program}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{c.title}</p>
                  {c.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{c.description}</p>
                  )}
                  {/* Categories */}
                  {c.categories && c.categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.categories.slice(0, 4).map((tag: string) => (
                        <span
                          key={tag}
                          className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {c.deadline ? (
                    <DeadlineBadge deadline={c.deadline} />
                  ) : (
                    <span className="text-xs text-gray-400">Aperto</span>
                  )}
                  {c.budget_total && (
                    <p className="mt-1 text-xs text-gray-400">{formatEur(c.budget_total)} totale</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-sm text-gray-400">
          Nessun bando corrisponde ai filtri selezionati.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mb-10">
          {pagina > 1 && (
            <Link href={buildUrl({ pagina: String(pagina - 1) })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
              ← Precedente
            </Link>
          )}
          <span className="text-xs text-gray-400">Pagina {pagina} di {totalPages}</span>
          {pagina < totalPages && (
            <Link href={buildUrl({ pagina: String(pagina + 1) })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
              Successiva →
            </Link>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Dati aggiornati periodicamente. Verifica sempre le condizioni ufficiali prima di candidarti.
      </p>
    </main>
  )
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
  const label = formatDate(deadline)
  if (days < 0) return <span className="text-xs text-gray-300">Scaduto</span>
  if (days <= 14)
    return (
      <span className="inline-block rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-600 font-medium">
        {days}gg rimasti
      </span>
    )
  if (days <= 60)
    return (
      <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-600">
        {label}
      </span>
    )
  return <span className="text-xs text-gray-400">{label}</span>
}
