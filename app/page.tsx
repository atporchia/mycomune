import ComuneSearch from '@/app/components/ComuneSearch'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="mb-3 text-sm font-semibold tracking-widest text-emerald-600 uppercase">
        MyComune
      </p>

      <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        I soldi pubblici del tuo Comune,{' '}
        <span className="text-emerald-600">spiegati in modo semplice.</span>
      </h1>

      <p className="mb-10 max-w-xl text-lg text-gray-500">
        Cerca il tuo Comune e scopri i progetti PNRR finanziati con denaro pubblico.
        Dati ufficiali, spiegati in modo chiaro.
      </p>

      <ComuneSearch />

      <p className="mt-4 text-xs text-gray-400">
        Dati: OpenPNRR · ItaliaDomani · aggiornati ogni settimana
      </p>

      <div className="mt-16 rounded-xl border border-gray-100 bg-gray-50 px-6 py-5 text-left max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
          Trasparenza sui dati
        </p>
        <p className="text-sm text-gray-600">
          MyComune controlla le fonti ufficiali ogni giorno e aggiorna i dati ogni settimana.
          Ogni pagina mostra sempre la data dell&apos;ultimo aggiornamento e la fonte originale.
        </p>
      </div>
    </main>
  )
}
