import Papa from 'papaparse'
import { normalizeOpenPNRRRow, type NormalizedProject } from './normalize'

/**
 * OpenPNRR dataset download URLs.
 *
 * openpnrr.it publishes a bulk CSV export. The exact URL may change; check
 * https://openpnrr.it for the current download link and update OPENPNRR_CSV_URL
 * in your environment. The default below points to their typical export path.
 */
const DEFAULT_CSV_URL =
  process.env.OPENPNRR_CSV_URL || 'https://openpnrr.it/export/projects.csv'

export interface FetchResult {
  records: NormalizedProject[]
  rawRowCount: number
  skipped: number
  sourceUrl: string
  declaredUpdateDate: string | null
}

export async function fetchOpenPNRR(): Promise<FetchResult> {
  const response = await fetch(DEFAULT_CSV_URL, {
    headers: { 'Accept': 'text/csv,application/octet-stream,*/*' },
    // 5-minute timeout via AbortController
    signal: AbortSignal.timeout(5 * 60 * 1000),
  })

  if (!response.ok) {
    throw new Error(`OpenPNRR fetch failed: ${response.status} ${response.statusText}`)
  }

  const csvText = await response.text()

  // Extract declared update date from Last-Modified header if present
  const lastModified = response.headers.get('last-modified')
  let declaredUpdateDate: string | null = null
  if (lastModified) {
    const d = new Date(lastModified)
    if (!isNaN(d.getTime())) {
      declaredUpdateDate = d.toISOString().split('T')[0]
    }
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })

  const records: NormalizedProject[] = []
  let skipped = 0

  for (const row of parsed.data) {
    const normalized = normalizeOpenPNRRRow(row)
    if (normalized) {
      records.push(normalized)
    } else {
      skipped++
    }
  }

  return {
    records,
    rawRowCount: parsed.data.length,
    skipped,
    sourceUrl: DEFAULT_CSV_URL,
    declaredUpdateDate,
  }
}
