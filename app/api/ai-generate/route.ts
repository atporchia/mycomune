import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateProjectExplanation, generateComuneSummary } from '@/lib/ingest/ai'

const PROJECTS_BATCH = 30
const COMUNI_BATCH = 10

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    projects: { processed: 0, failed: 0 },
    comuni: { processed: 0, failed: 0 },
  }

  // --- Projects without AI explanation ---
  const { data: projects, error: pErr } = await supabaseAdmin
    .from('projects')
    .select('id, title, description, amount_total, implementing_entity, status, category, mission, comune, watch_signals')
    .is('ai_explanation', null)
    .limit(PROJECTS_BATCH)

  if (pErr) {
    return NextResponse.json({ error: `Failed to fetch projects: ${pErr.message}` }, { status: 500 })
  }

  for (const project of projects ?? []) {
    try {
      const ai = await generateProjectExplanation(project)
      const { error: updateErr } = await supabaseAdmin
        .from('projects')
        .update({
          ai_explanation: ai.explanation,
          ai_suggested_questions: ai.questions,
          ai_generated_at: new Date().toISOString(),
        })
        .eq('id', project.id)

      if (updateErr) throw new Error(updateErr.message)
      results.projects.processed++
    } catch (err) {
      console.error(`AI generation failed for project ${project.id}:`, err)
      results.projects.failed++
    }
  }

  // --- Comuni without AI summary ---
  const { data: comuni, error: cErr } = await supabaseAdmin
    .from('comuni')
    .select('id, nome, province, region, total_projects, total_funding, avg_project_value')
    .is('ai_summary', null)
    .gt('total_projects', 0)
    .limit(COMUNI_BATCH)

  if (cErr) {
    return NextResponse.json(
      { error: `Failed to fetch comuni: ${cErr.message}`, projects: results.projects },
      { status: 500 }
    )
  }

  for (const comune of comuni ?? []) {
    try {
      const ai = await generateComuneSummary(comune)
      const { error: updateErr } = await supabaseAdmin
        .from('comuni')
        .update({
          ai_summary: ai.summary,
          ai_summary_generated_at: new Date().toISOString(),
        })
        .eq('id', comune.id)

      if (updateErr) throw new Error(updateErr.message)
      results.comuni.processed++
    } catch (err) {
      console.error(`AI generation failed for comune ${comune.nome}:`, err)
      results.comuni.failed++
    }
  }

  return NextResponse.json({
    ok: true,
    projects: results.projects,
    comuni: results.comuni,
  })
}
