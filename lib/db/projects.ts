import sql from '../db'
import type { NormalizedProject } from '../ingest/normalize'

export async function upsertProjects(
  records: NormalizedProject[],
  batchSize = 200
): Promise<{ inserted: number; updated: number }> {
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

    const result = await sql`
      INSERT INTO projects ${sql(rows)}
      ON CONFLICT (source, project_id) DO UPDATE SET
        source_url               = EXCLUDED.source_url,
        cup_code                 = EXCLUDED.cup_code,
        title                    = EXCLUDED.title,
        description              = EXCLUDED.description,
        amount_total             = EXCLUDED.amount_total,
        amount_public            = EXCLUDED.amount_public,
        mission                  = EXCLUDED.mission,
        component                = EXCLUDED.component,
        measure                  = EXCLUDED.measure,
        category                 = EXCLUDED.category,
        status                   = EXCLUDED.status,
        progress_percentage      = EXCLUDED.progress_percentage,
        implementing_entity      = EXCLUDED.implementing_entity,
        beneficiary_entity       = EXCLUDED.beneficiary_entity,
        comune                   = EXCLUDED.comune,
        province                 = EXCLUDED.province,
        region                   = EXCLUDED.region,
        latitude                 = EXCLUDED.latitude,
        longitude                = EXCLUDED.longitude,
        start_date               = EXCLUDED.start_date,
        expected_end_date        = EXCLUDED.expected_end_date,
        last_source_update       = EXCLUDED.last_source_update,
        last_seen_at             = EXCLUDED.last_seen_at,
        last_checked_by_watchdog = EXCLUDED.last_checked_by_watchdog,
        last_normalized_refresh  = EXCLUDED.last_normalized_refresh,
        watch_signals            = EXCLUDED.watch_signals
    `
    updated += result.count
  }

  return { inserted: 0, updated }
}

export async function rebuildComuniAggregates(): Promise<void> {
  await sql`
    INSERT INTO comuni (nome, province, region, total_projects, total_funding, avg_project_value, last_normalized_refresh, last_watchdog_check)
    SELECT
      UPPER(TRIM(comune))                                                AS nome,
      MAX(province)                                                      AS province,
      MAX(region)                                                        AS region,
      COUNT(*)::int                                                      AS total_projects,
      COALESCE(SUM(amount_total), 0)                                     AS total_funding,
      CASE WHEN COUNT(*) > 0
           THEN COALESCE(SUM(amount_total), 0) / COUNT(*)
           ELSE 0 END                                                    AS avg_project_value,
      NOW()                                                              AS last_normalized_refresh,
      NOW()                                                              AS last_watchdog_check
    FROM projects
    WHERE comune IS NOT NULL AND TRIM(comune) != ''
    GROUP BY UPPER(TRIM(comune))
    ON CONFLICT (nome) DO UPDATE SET
      province                = EXCLUDED.province,
      region                  = EXCLUDED.region,
      total_projects          = EXCLUDED.total_projects,
      total_funding           = EXCLUDED.total_funding,
      avg_project_value       = EXCLUDED.avg_project_value,
      last_normalized_refresh = EXCLUDED.last_normalized_refresh,
      last_watchdog_check     = EXCLUDED.last_watchdog_check
  `
}
