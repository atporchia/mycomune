import { supabaseAdmin } from '../supabase'
import type { NormalizedProject } from '../ingest/normalize'

/**
 * Upsert a batch of normalized projects.
 * Returns counts of inserted vs updated rows.
 */
export async function upsertProjects(
  records: NormalizedProject[],
  batchSize = 500
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0
  let updated = 0
  const now = new Date().toISOString()

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)

    const rows = batch.map((r) => ({
      project_id:               r.project_id,
      source:                   r.source,
      source_url:               r.source_url,
      cup_code:                 r.cup_code,
      title:                    r.title,
      description:              r.description,
      amount_total:             r.amount_total,
      amount_public:            r.amount_public,
      mission:                  r.mission,
      component:                r.component,
      measure:                  r.measure,
      category:                 r.category,
      status:                   r.status,
      progress_percentage:      r.progress_percentage,
      implementing_entity:      r.implementing_entity,
      beneficiary_entity:       r.beneficiary_entity,
      comune:                   r.comune,
      province:                 r.province,
      region:                   r.region,
      latitude:                 r.latitude,
      longitude:                r.longitude,
      start_date:               r.start_date,
      expected_end_date:        r.expected_end_date,
      last_source_update:       r.last_source_update,
      last_seen_at:             now,
      last_checked_by_watchdog: now,
      last_normalized_refresh:  now,
      raw_source_payload:       null,
      watch_signals:            r.watch_signals,
    }))

    const { error, count } = await supabaseAdmin
      .from('projects')
      .upsert(rows, {
        onConflict: 'source,project_id',
        count: 'exact',
      })

    if (error) throw new Error(`Upsert error: ${error.message}`)
    // count reflects all affected rows; we can't distinguish insert vs update
    // without a more complex approach, so we treat everything as updated here
    // and caller can compare with pre-existing count if needed.
    updated += count ?? 0
  }

  return { inserted, updated }
}

/**
 * Rebuild the comuni aggregates table from the projects table.
 * Delegates to a Postgres function so the full 300k+ row dataset is
 * aggregated in-DB without hitting the JS client's default 1k row limit.
 * Requires migration 003_rebuild_comuni_fn.sql to be applied first.
 */
export async function rebuildComuniAggregates(): Promise<void> {
  const { error } = await supabaseAdmin.rpc('rebuild_comuni_aggregates')
  if (error) throw new Error(`comuni rebuild failed: ${error.message}`)
}
