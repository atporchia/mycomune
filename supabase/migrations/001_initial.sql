-- MyComune — initial schema
-- Run this in Supabase SQL Editor or via supabase db push

-- ----------------------------------------------------------------
-- projects: one row per normalized PNRR project record
-- ----------------------------------------------------------------
create table if not exists projects (
  id                          uuid primary key default gen_random_uuid(),
  project_id                  text not null,        -- source-unique key (e.g. CUP or openpnrr internal id)
  source                      text not null,        -- 'openpnrr' | 'italiadomani'
  source_url                  text,
  cup_code                    text,
  title                       text not null,
  description                 text,
  amount_total                numeric(18,2),
  amount_public               numeric(18,2),
  mission                     text,                 -- PNRR mission (M1–M6)
  component                   text,
  measure                     text,
  category                    text,
  status                      text,
  progress_percentage         numeric(5,2),
  implementing_entity         text,
  beneficiary_entity          text,
  comune                      text,
  province                    text,
  region                      text,
  latitude                    numeric(10,7),
  longitude                   numeric(10,7),
  start_date                  date,
  expected_end_date           date,
  last_source_update          date,
  first_seen_at               timestamptz not null default now(),
  last_seen_at                timestamptz not null default now(),
  last_checked_by_watchdog    timestamptz,
  last_normalized_refresh     timestamptz,
  raw_source_payload          jsonb,
  watch_signals               text[] default '{}',
  constraint projects_source_project_id_unique unique (source, project_id)
);

create index if not exists projects_comune_idx       on projects (comune);
create index if not exists projects_province_idx     on projects (province);
create index if not exists projects_region_idx       on projects (region);
create index if not exists projects_source_idx       on projects (source);
create index if not exists projects_amount_total_idx on projects (amount_total desc);
create inverted index if not exists projects_watch_signals_idx on projects (watch_signals);

-- ----------------------------------------------------------------
-- comuni: pre-aggregated stats per Comune, rebuilt after each ingest
-- ----------------------------------------------------------------
create table if not exists comuni (
  id                          uuid primary key default gen_random_uuid(),
  nome                        text not null unique,
  province                    text,
  region                      text,
  total_projects              integer not null default 0,
  total_funding               numeric(18,2) not null default 0,
  avg_project_value           numeric(18,2),
  last_watchdog_check         timestamptz,
  last_normalized_refresh     timestamptz,
  official_source_last_update date
);

create index if not exists comuni_nome_idx     on comuni (nome);
create index if not exists comuni_province_idx on comuni (province);
create index if not exists comuni_region_idx   on comuni (region);

-- ----------------------------------------------------------------
-- ingestion_logs: one row per ingest run
-- ----------------------------------------------------------------
create table if not exists ingestion_logs (
  id                uuid primary key default gen_random_uuid(),
  source            text not null,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  status            text not null default 'running',  -- 'running' | 'success' | 'failure'
  records_fetched   integer,
  records_new       integer,
  records_updated   integer,
  records_removed   integer,
  error_message     text
);

-- ----------------------------------------------------------------
-- source_metadata: availability + declared update date per source
-- ----------------------------------------------------------------
create table if not exists source_metadata (
  id                    uuid primary key default gen_random_uuid(),
  source_name           text not null unique,
  source_url            text not null,
  last_checked_at       timestamptz,
  last_available_at     timestamptz,
  declared_update_date  date,
  is_available          boolean,
  notes                 text
);

-- Seed known sources
insert into source_metadata (source_name, source_url, notes)
values
  ('openpnrr',     'https://openpnrr.it',                    'Primary MVP source'),
  ('italiadomani', 'https://italiadomani.gov.it/it/Interventi/open-data.html', 'Cross-check source')
on conflict (source_name) do nothing;
