-- MyComune — Phase 3: AI-generated content columns
-- Run this in Supabase SQL Editor after 001_initial.sql

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS ai_explanation          text,
  ADD COLUMN IF NOT EXISTS ai_suggested_questions  text[],
  ADD COLUMN IF NOT EXISTS ai_generated_at         timestamptz;

ALTER TABLE comuni
  ADD COLUMN IF NOT EXISTS ai_summary              text,
  ADD COLUMN IF NOT EXISTS ai_summary_generated_at timestamptz;
