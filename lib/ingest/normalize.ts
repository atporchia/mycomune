/**
 * Maps a raw OpenPNRR CSV row to our common project schema.
 *
 * OpenPNRR field names are Italian; we map them defensively since column
 * names can change between dataset releases. All fields are optional except
 * project_id and title — those must exist for the record to be useful.
 *
 * Field reference: https://openpnrr.it (CSV column headers as of 2025)
 */

export interface NormalizedProject {
  project_id: string
  source: 'openpnrr'
  source_url: string | null
  cup_code: string | null
  title: string
  description: string | null
  amount_total: number | null
  amount_public: number | null
  mission: string | null
  component: string | null
  measure: string | null
  category: string | null
  status: string | null
  progress_percentage: number | null
  implementing_entity: string | null
  beneficiary_entity: string | null
  comune: string | null
  province: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  start_date: string | null
  expected_end_date: string | null
  last_source_update: string | null
  raw_source_payload: Record<string, unknown>
  watch_signals: string[]
}

function parseAmount(val: string | undefined): number | null {
  if (!val) return null
  // OpenPNRR CSV uses plain decimal notation (e.g. "542060775.00"), not
  // Italian thousands-separator formatting — parse directly.
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function parseDate(val: string | undefined): string | null {
  if (!val || val.trim() === '') return null
  // Accept dd/mm/yyyy or yyyy-mm-dd
  const ddmmyyyy = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
  const iso = val.match(/^\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  return null
}

function parseFloat_(val: string | undefined): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(',', '.'))
  return isNaN(n) ? null : n
}

// Pick a field by trying multiple possible column names (defensive mapping)
function pick(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    if (row[k] !== undefined && row[k].trim() !== '') return row[k].trim()
  }
  return undefined
}

function computeWatchSignals(p: NormalizedProject): string[] {
  const signals: string[] = []
  if (p.amount_total !== null && p.amount_total >= 1_000_000) signals.push('high-value project')
  if (!p.expected_end_date) signals.push('missing expected completion date')
  if (!p.implementing_entity) signals.push('missing implementing entity')
  if (!p.description || p.description.length < 20) signals.push('unclear description')
  // Generic titles: very short or contain only common bureaucratic words
  if (p.title && p.title.split(' ').length <= 3) signals.push('generic title')
  return signals
}

export function normalizeOpenPNRRRow(row: Record<string, string>): NormalizedProject | null {
  // progetto_id is the primary key; fall back to CUP if absent
  const projectId =
    pick(row, 'progetto_id', 'CUP', 'cup', 'codice_cup', 'ID', 'id', 'codice_progetto') ?? null

  const title =
    pick(row,
      'titolo', 'TITOLO_PROGETTO', 'titolo_progetto', 'TITOLO',
      'DENOMINAZIONE', 'denominazione', 'OGGETTO', 'oggetto'
    ) ?? null

  if (!projectId || !title) return null

  // Divide amounts proportionally when a project spans multiple comuni so that
  // each comune receives its fair share rather than the full national amount.
  const comuniCount = Math.max(1, parseInt(row['_comuni_count'] ?? '1', 10))
  const divideAmount = (raw: string | undefined): number | null => {
    const n = parseAmount(raw)
    return n !== null ? Math.round(n / comuniCount) : null
  }

  const cupCode = pick(row, 'cup', 'CUP', 'codice_cup') ?? null

  const normalized: NormalizedProject = {
    project_id:           projectId,
    source:               'openpnrr',
    // OpenCUP publishes a public detail page per CUP code — verified pattern.
    source_url:           cupCode ? `https://opencup.gov.it/portale/progetto/-/cup/${cupCode}` : null,
    cup_code:             cupCode,
    title,
    description:          pick(row, 'descrizione', 'DESCRIZIONE', 'OGGETTO', 'oggetto') ?? null,
    amount_total:         divideAmount(pick(row, 'finanziamento_totale', 'IMPORTO_TOTALE', 'importo_totale', 'finanziamento', 'IMPORTO', 'importo')),
    amount_public:        divideAmount(pick(row, 'finanziamento_totale_pubblico', 'IMPORTO_PUBBLICO', 'importo_pubblico', 'QUOTA_PUBBLICA', 'quota_pubblica')),
    mission:              pick(row, 'codice_misura', 'MISSIONE', 'missione', 'MISSION', 'mission') ?? null,
    component:            pick(row, 'COMPONENTE', 'componente', 'COMPONENT', 'component') ?? null,
    measure:              pick(row, 'codice_misura', 'MISURA', 'misura', 'MEASURE', 'measure', 'INVESTIMENTO', 'investimento') ?? null,
    category:             pick(row, 'SETTORE', 'settore', 'CATEGORIA', 'categoria', 'TIPOLOGIA') ?? null,
    status:               pick(row, 'STATO', 'stato', 'STATO_PROGETTO', 'stato_progetto') ?? null,
    progress_percentage:  parseFloat_(pick(row, 'AVANZAMENTO', 'avanzamento', 'PERCENTUALE_AVANZAMENTO', 'percentuale_avanzamento')),
    implementing_entity:  pick(row, 'soggetto_attuatore_denominazione', 'SOGGETTO_ATTUATORE', 'soggetto_attuatore', 'ENTE_ATTUATORE', 'ente_attuatore') ?? null,
    beneficiary_entity:   pick(row, 'SOGGETTO_BENEFICIARIO', 'soggetto_beneficiario', 'BENEFICIARIO') ?? null,
    // Location fields are injected by the fetcher from progetti_territori.csv
    comune:               pick(row, '_comune', 'COMUNE', 'comune', 'LOCALITA', 'localita') ?? null,
    province:             pick(row, '_province', 'PROVINCIA', 'provincia', 'SIGLA_PROVINCIA', 'sigla_provincia') ?? null,
    region:               pick(row, '_region', 'REGIONE', 'regione') ?? null,
    latitude:             parseFloat_(pick(row, 'LAT', 'lat', 'LATITUDINE', 'latitudine')),
    longitude:            parseFloat_(pick(row, 'LON', 'lon', 'LONGITUDINE', 'longitudine')),
    start_date:           parseDate(pick(row, 'DATA_INIZIO', 'data_inizio', 'DATA_AVVIO', 'data_avvio')),
    expected_end_date:    parseDate(pick(row, 'DATA_FINE_PREVISTA', 'data_fine_prevista', 'DATA_CONCLUSIONE', 'data_conclusione', 'SCADENZA')),
    last_source_update:   parseDate(pick(row, 'DATA_AGGIORNAMENTO', 'data_aggiornamento', 'ULTIMO_AGGIORNAMENTO')),
    raw_source_payload:   row as Record<string, unknown>,
    watch_signals:        [],
  }

  normalized.watch_signals = computeWatchSignals(normalized)
  return normalized
}
