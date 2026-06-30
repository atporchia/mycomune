import { notFound } from 'next/navigation'
import Link from 'next/link'
import sql from '@/lib/db'
import { toTitleCase, formatEur, formatDate } from '@/lib/format'
import FreshnessBadge from '@/app/components/FreshnessBadge'
import { generateComuneSummary } from '@/lib/ingest/ai'

export default async function ComunePage({
  params,
}: {
  params: Promise<{ comune: string }>
}) {
  const { comune: comuneSlug } = await params
  const comuneName = decodeURIComponent(comuneSlug)

  const [comune, projects, source] = await Promise.all([
    sql`SELECT * FROM comuni WHERE nome ILIKE ${comuneName} LIMIT 1`.then(r => r[0] ?? null),
    sql`
      SELECT id, title, amount_total, category, mission, implementing_entity, watch_signals, last_seen_at
      FROM projects
      WHERE comune ILIKE ${comuneName}
      ORDER BY amount_total DESC NULLS LAST
      LIMIT 200
    `,
    sql`
      SELECT source_url, last_checked_at, declared_update_date
      FROM source_metadata
      WHERE source_name = 'openpnrr'
      LIMIT 1
    `.then(r => r[0] ?? null),
  ])

  if (!comune) notFound()

  if (!comune.ai_summary && process.env.GROQ_API_KEY) {
    try {
      const ai = await generateComuneSummary({
        nome: comune.nome,
        province: comune.province,
        region: comune.region,
        total_projects: comune.total_projects,
        total_funding: Number(comune.total_funding),
        avg_project_value: Number(comune.avg_project_value),
      })
      await sql`
        UPDATE comuni SET
          ai_summary              = ${ai.summary},
          ai_summary_generated_at = NOW()
        WHERE nome = ${comune.nome}
      `
      comune.ai_summary = ai.summary
    } catch (err) {
      console.error('[AI] comune summary failed', comune.nome, err)
    }
  }

  if (comune.total_projects === 0) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-emerald-600 hover:underline">
          ← Torna alla ricerca
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-gray-900">
          {toTitleCase(comune.nome)}
        </h1>
        <p className="mt-4 text-gray-500">
          Nessun progetto PNRR è attualmente disponibile nel dataset per questo Comune.
        </p>
        <FreshnessBadge
          watchdogCheck={comune.last_watchdog_check}
          officialUpdate={comune.official_source_last_update}
          sourceUrl={source?.source_url}
        />
      </main>
    )
  }

  const top5 = projects.slice(0, 5)

  const categoryCounts: Record<string, number> = {}
  for (const p of projects) {
    const cat = p.category || p.mission || 'Non classificato'
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const entityCounts: Record<string, number> = {}
  for (const p of projects) {
    if (p.implementing_entity) {
      entityCounts[p.implementing_entity] =
        (entityCounts[p.implementing_entity] ?? 0) + 1
    }
  }
  const topEntities = Object.entries(entityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const flagged = projects
    .filter((p) => p.watch_signals && p.watch_signals.length > 0)
    .slice(0, 5)

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-emerald-600 hover:underline">
          ← Torna alla ricerca
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
          Comune
          {comune.province ? ` · ${comune.province}` : ''}
          {comune.region ? ` · ${comune.region}` : ''}
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          {toTitleCase(comune.nome)}
        </h1>
      </div>

      {/* AI summary */}
      {comune.ai_summary && (
        <section className="mb-8 rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
            Panoramica PNRR
          </p>
          <p className="text-sm text-emerald-900 leading-relaxed">{comune.ai_summary}</p>
        </section>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Progetti PNRR" value={comune.total_projects.toLocaleString('it-IT')} />
        <StatCard label="Finanziamento totale" value={formatEur(comune.total_funding)} />
        <StatCard
          label="Valore medio progetto"
          value={comune.avg_project_value ? formatEur(comune.avg_project_value) : 'N/D'}
        />
      </div>

      {/* Freshness */}
      <FreshnessBadge
        watchdogCheck={comune.last_watchdog_check}
        officialUpdate={comune.official_source_last_update}
        sourceUrl={source?.source_url}
      />

      {/* Top 5 projects */}
      {top5.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Progetti per importo
          </h2>
          <div className="space-y-2">
            {top5.map((p) => (
              <Link
                key={p.id}
                href={`/${comuneSlug}/progetti/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.category ?? p.mission ?? 'Categoria non disponibile'}
                  </p>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <p className="text-sm font-semibold text-emerald-700">
                    {formatEur(p.amount_total)}
                  </p>
                  {p.watch_signals && p.watch_signals.length > 0 && (
                    <p className="text-xs text-amber-500 mt-0.5">● {p.watch_signals[0]}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <Link
              href={`/${comuneSlug}/progetti`}
              className="text-sm text-emerald-600 hover:underline"
            >
              Vedi tutti i {comune.total_projects} progetti →
            </Link>
          </div>
        </section>
      )}

      {/* Categories + Entities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
        {topCategories.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Categorie principali</h2>
            <ul className="space-y-2">
              {topCategories.map(([cat, count]) => (
                <li key={cat} className="flex justify-between text-sm">
                  <span className="text-gray-700 truncate">{cat}</span>
                  <span className="ml-2 shrink-0 text-gray-400 tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {topEntities.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Enti attuatori principali
            </h2>
            <ul className="space-y-2">
              {topEntities.map(([entity, count]) => (
                <li key={entity} className="flex justify-between text-sm">
                  <span className="text-gray-700 truncate">{entity}</span>
                  <span className="ml-2 shrink-0 text-gray-400 tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Flagged projects */}
      {flagged.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Progetti da monitorare</h2>
          <div className="space-y-2">
            {flagged.map((p) => (
              <Link
                key={p.id}
                href={`/${comuneSlug}/progetti/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm hover:border-amber-200 transition-colors"
              >
                <span className="text-gray-800 truncate">{p.title}</span>
                <span className="ml-4 shrink-0 text-xs text-amber-600">
                  {p.watch_signals?.join(' · ')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Last refresh note */}
      {comune.last_normalized_refresh && (
        <p className="text-xs text-gray-400">
          Ultimo aggiornamento normalizzato: {formatDate(comune.last_normalized_refresh)}
        </p>
      )}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
