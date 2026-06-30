import { notFound } from 'next/navigation'
import Link from 'next/link'
import sql from '@/lib/db'
import { formatEur, formatDate } from '@/lib/format'
export default async function BandoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [call] = await sql`SELECT * FROM funding_calls WHERE id = ${id} LIMIT 1`
  if (!call) notFound()

  const days = call.deadline
    ? Math.ceil((new Date(call.deadline).getTime() - Date.now()) / 86_400_000)
    : null

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex gap-2 text-sm text-emerald-600">
        <Link href="/" className="hover:underline">← Home</Link>
        <span className="text-gray-300">/</span>
        <Link href="/bandi" className="hover:underline">Bandi aperti</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500 truncate max-w-xs">{call.title}</span>
      </div>

      {/* Program badge + title */}
      <div className="mb-6">
        {call.program && (
          <span className="inline-block mb-2 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
            {call.program}
          </span>
        )}
        <h1 className="text-2xl font-bold text-gray-900 leading-snug">{call.title}</h1>

        {/* Categories */}
        {call.categories && call.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {call.categories.map((tag: string) => (
              <Link
                key={tag}
                href={`/bandi?cat=${encodeURIComponent(tag)}`}
                className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <InfoBox
          label="Scadenza"
          value={
            call.deadline
              ? days !== null && days < 0
                ? 'Scaduto'
                : `${formatDate(call.deadline)}${days !== null && days <= 60 ? ` (${days} giorni)` : ''}`
              : 'Aperto senza scadenza fissa'
          }
          highlight={days !== null && days >= 0 && days <= 14}
        />
        <InfoBox
          label="Budget totale"
          value={call.budget_total ? formatEur(call.budget_total) : 'Non specificato'}
        />
        <InfoBox label="Stato" value={call.status === 'open' ? '✓ Aperto' : call.status} />
        <InfoBox label="Programma" value={call.program} />
      </div>

      {/* Description */}
      {call.description && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Descrizione ufficiale</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{call.description}</p>
        </section>
      )}

      {/* AI explanation */}
      <section className="mb-8 rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
        <h2 className="text-sm font-semibold text-emerald-800 mb-2">
          Spiegazione in modo semplice
        </h2>
        {call.ai_explanation ? (
          <>
            <p className="text-sm text-emerald-900 leading-relaxed mb-4">
              {call.ai_explanation}
            </p>
            {call.ai_tips && call.ai_tips.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-2">
                  Come iniziare:
                </p>
                <ol className="space-y-1.5 list-none">
                  {call.ai_tips.map((tip: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-emerald-800">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-emerald-600 italic">
            Spiegazione non disponibile al momento.
          </p>
        )}
      </section>

      {/* CTA */}
      {call.url && (
        <a
          href={call.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700 transition-colors mb-8"
        >
          Vai al bando ufficiale →
        </a>
      )}

      <p className="text-xs text-gray-400">
        Aggiornato il {formatDate(call.last_checked_at)}. Verifica sempre le condizioni
        ufficiali prima di candidarti.
      </p>
    </main>
  )
}

function InfoBox({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | null | undefined
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${highlight ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-red-700' : 'text-gray-900'}`}>
        {value || <span className="text-gray-300 font-normal italic">non disponibile</span>}
      </p>
    </div>
  )
}
