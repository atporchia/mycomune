import Link from 'next/link'
import ComuneSearch from '@/app/components/ComuneSearch'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-3 text-sm font-semibold tracking-widest text-emerald-600 uppercase">
        FondiRadar
      </p>

      <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        I fondi pubblici alla tua portata,{' '}
        <span className="text-emerald-600">spiegati in modo semplice.</span>
      </h1>

      <p className="mb-12 max-w-xl text-lg text-gray-500">
        Controlla dove vanno i soldi del tuo Comune — e scopri i bandi europei e italiani
        a cui puoi candidarti.
      </p>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {/* PNRR tracker */}
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-7 flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
            Fondi PNRR
          </p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Traccia i fondi del tuo Comune</h2>
          <p className="text-sm text-gray-500 mb-6">
            Inserisci il nome del tuo Comune e vedi tutti i progetti finanziati con denaro
            pubblico: importi, enti responsabili e stato di avanzamento.
          </p>
          <div className="mt-auto">
            <ComuneSearch />
          </div>
        </div>

        {/* Bandi aperti */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-8 py-7 flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
            Bandi aperti
          </p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Trova finanziamenti per te</h2>
          <p className="text-sm text-gray-600 mb-6">
            Oltre 600 bandi europei e italiani ancora disponibili per imprese, agricoltori,
            startup e cittadini. Filtra per categoria o regione e trova quelli a cui puoi
            candidarti oggi.
          </p>
          <div className="mt-auto">
            <Link
              href="/bandi"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Esplora i bandi aperti
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-10 text-xs text-gray-400">
        Dati: OpenPNRR · ItaliaDomani · EU Funding &amp; Tenders Portal · MIMIT · aggiornati ogni settimana
      </p>
    </main>
  )
}
