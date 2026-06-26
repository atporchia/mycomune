import Papa from 'papaparse'
import { normalizeOpenPNRRRow, type NormalizedProject } from './normalize'

const BASE_URL = 'https://openpnrr.s3.amazonaws.com/media'
const PROJECTS_URL = process.env.OPENPNRR_CSV_URL || `${BASE_URL}/progetti.csv`
const TERRITORI_URL = `${BASE_URL}/progetti_territori.csv`

export interface FetchResult {
  records: NormalizedProject[]
  rawRowCount: number
  skipped: number
  sourceUrl: string
  declaredUpdateDate: string | null
}

async function fetchCsv(url: string): Promise<{ rows: Record<string, string>[]; lastModified: string | null }> {
  const response = await fetch(url, {
    headers: { 'Accept': 'text/csv,application/octet-stream,*/*' },
    signal: AbortSignal.timeout(5 * 60 * 1000),
  })
  if (!response.ok) throw new Error(`OpenPNRR fetch failed (${url}): ${response.status} ${response.statusText}`)

  const text = await response.text()
  const lastModified = response.headers.get('last-modified')

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })

  return { rows: parsed.data, lastModified }
}

// tipologia codes in progetti_territori: C=Comune, P=Provincia, R=Regione, N=Nazione
type TerritoryMap = Map<string, { comune: string | null; province: string | null; region: string | null }>

function buildTerritoryMap(rows: Record<string, string>[]): TerritoryMap {
  const map: TerritoryMap = new Map()

  for (const row of rows) {
    const id = row['progetto_id']
    if (!id) continue

    const tipo = row['tipologia']?.toUpperCase()
    const nome = row['denominazione']?.trim() || null
    if (!nome) continue

    const entry = map.get(id) ?? { comune: null, province: null, region: null }

    if (tipo === 'C' && !entry.comune) entry.comune = nome
    else if (tipo === 'P' && !entry.province) entry.province = nome
    else if (tipo === 'R' && !entry.region) entry.region = nome

    map.set(id, entry)
  }

  return map
}

export async function fetchOpenPNRR(): Promise<FetchResult> {
  const [projectsResult, territoriResult] = await Promise.all([
    fetchCsv(PROJECTS_URL),
    fetchCsv(TERRITORI_URL),
  ])

  const territoryMap = buildTerritoryMap(territoriResult.rows)

  const lastModified = projectsResult.lastModified
  let declaredUpdateDate: string | null = null
  if (lastModified) {
    const d = new Date(lastModified)
    if (!isNaN(d.getTime())) declaredUpdateDate = d.toISOString().split('T')[0]
  }

  const records: NormalizedProject[] = []
  let skipped = 0

  for (const row of projectsResult.rows) {
    const id = row['progetto_id']
    const territory = id ? (territoryMap.get(id) ?? null) : null

    // Inject territory fields so the normalizer can pick them up
    const enriched = {
      ...row,
      _comune:   territory?.comune   ?? '',
      _province: territory?.province ?? '',
      _region:   territory?.region   ?? '',
    }

    const normalized = normalizeOpenPNRRRow(enriched)
    if (normalized) records.push(normalized)
    else skipped++
  }

  return {
    records,
    rawRowCount: projectsResult.rows.length,
    skipped,
    sourceUrl: PROJECTS_URL,
    declaredUpdateDate,
  }
}
