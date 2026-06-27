import { notFound } from 'next/navigation'
import Link from 'next/link'
import sql from '@/lib/db'
import { toTitleCase, formatEur, formatDate } from '@/lib/format'
import FreshnessBadge from '@/app/components/FreshnessBadge'
import { generateProjectExplanation } from '@/lib/ingest/ai'

export default async function ProgettoDetailPage({
  params,
}: {
  params: Promise<{ comune: string; id: string }>
}) {
  const { comune: comuneSlug, id } = await params
  const comuneName = decodeURIComponent(comuneSlug)

  const [project, source] = await Promise.all([
    sql`SELECT * FROM projects WHERE id = ${id} AND comune ILIKE ${comuneName} LIMIT 1`
      .then(r => r[0] ?? null),
    sql`
      SELECT source_url, last_checked_at, declared_update_date
      FROM source_metadata
      WHERE source_name = 'openpnrr'
      LIMIT 1
    `.then(r => r[0] ?? null),
  ])

  if (!project) notFound()

  // Lazy AI generation: generate on first visit, cache in DB forever
  if (!project.ai_explanation && process.env.GOOGLE_AI_API_KEY) {
    try {
      const ai = await generateProjectExplanation(project as Parameters<typeof generateProjectExplanation>[0])
      await sql`
        UPDATE projects SET
          ai_explanation         = ${ai.explanation},
          ai_suggested_questions = ${ai.questions},
          ai_generated_at        = NOW()
        WHERE id = ${project.id}
      `
      project.ai_explanation = ai.explanation
      project.ai_suggested_questions = ai.questions
    } catch {
      // AI generation failed silently — page still renders without explanation
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex flex-wrap gap-2 text-sm text-emerald-600">
        <Link href="/" className="hover:underline">← Home</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/${comuneSlug}`} className="hover:underline">
          {toTitleCase(project.comune ?? comuneName)}
        </Link>
        <span className="text-gray-300">/</span>
        <Link href={`/${comuneSlug}/progetti`} className="hover:underline">Progetti</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500 truncate max-w-xs">{project.title}</span>
      </div>

      {/* Title + watch signals */}
      <div className="mb-6">
        {project.watch_signals && project.watch_signals.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {project.watch_signals.map((s: string) => (
              <span
                key={s}
                className="inline-block rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-600"
              >
                {s}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 leading-snug">{project.title}</h1>
        {project.cup_code && (
          <p className="mt-1 text-xs text-gray-400 font-mono">CUP: {project.cup_code}</p>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <InfoBox label="Importo totale" value={formatEur(project.amount_total)} large />
        <InfoBox label="Importo pubblico" value={formatEur(project.amount_public)} />
        <InfoBox label="Comune" value={toTitleCase(project.comune ?? comuneName)} />
        <InfoBox
          label="Provincia · Regione"
          value={[project.province, project.region].filter(Boolean).join(' · ') || 'N/D'}
        />
      </div>

      {/* Description */}
      {project.description ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Descrizione</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Descrizione</h2>
          <p className="text-sm text-gray-400 italic">non disponibile nei dati</p>
        </section>
      )}

      {/* Project details */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Dettagli progetto</h2>
        <dl className="divide-y divide-gray-100">
          <Field label="Missione PNRR" value={project.mission} />
          <Field label="Componente" value={project.component} />
          <Field label="Misura" value={project.measure} />
          <Field label="Categoria" value={project.category} />
          <Field label="Stato" value={project.status} />
          <Field
            label="Avanzamento"
            value={project.progress_percentage != null ? `${project.progress_percentage}%` : null}
          />
          <Field label="Ente attuatore" value={project.implementing_entity} />
          <Field label="Ente beneficiario" value={project.beneficiary_entity} />
          <Field label="Data inizio" value={formatDate(project.start_date)} />
          <Field label="Data fine prevista" value={formatDate(project.expected_end_date)} />
          <Field label="Fonte" value={project.source} />
        </dl>
      </section>

      {/* Freshness */}
      <FreshnessBadge
        watchdogCheck={project.last_checked_by_watchdog ?? project.last_seen_at}
        officialUpdate={project.last_source_update ?? source?.declared_update_date}
        sourceUrl={project.source_url ?? source?.source_url}
      />

      {/* AI explanation */}
      <section className="mb-8 rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
        <h2 className="text-sm font-semibold text-emerald-800 mb-2">
          Spiegazione in modo semplice
        </h2>
        {project.ai_explanation ? (
          <>
            <p className="text-sm text-emerald-900 leading-relaxed mb-4">
              {project.ai_explanation}
            </p>
            {project.ai_suggested_questions && project.ai_suggested_questions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-2">
                  Domande che puoi fare al tuo Comune:
                </p>
                <ul className="space-y-1.5">
                  {project.ai_suggested_questions.map((q: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-emerald-800">
                      <span className="shrink-0 text-emerald-400">›</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-emerald-600 italic">
            La spiegazione verrà generata al prossimo aggiornamento.
          </p>
        )}
      </section>

      {/* Source link */}
      {(project.source_url ?? source?.source_url) && (
        <p className="text-xs text-gray-400">
          Dati originali:{' '}
          <a
            href={project.source_url ?? source?.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {project.source ?? 'OpenPNRR'}
          </a>
        </p>
      )}
    </main>
  )
}

function InfoBox({
  label,
  value,
  large,
}: {
  label: string
  value: string | null | undefined
  large?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`font-semibold text-gray-900 ${large ? 'text-xl' : 'text-sm'}`}>
        {value || <span className="text-gray-300 font-normal italic">non disponibile</span>}
      </p>
    </div>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="py-2.5 flex justify-between gap-4 text-sm">
      <dt className="text-gray-400 shrink-0">{label}</dt>
      <dd className="text-gray-800 text-right">
        {value || <span className="text-gray-300 italic">non disponibile</span>}
      </dd>
    </div>
  )
}
