import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { generateProjectExplanation, generateComuneSummary, generateCallExplanation } from '@/lib/ingest/ai'

const PROJECTS_BATCH = 5
const COMUNI_BATCH = 3
const CALLS_BATCH = 5

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const version = 'groq-v1'
  const results = {
    projects: { processed: 0, failed: 0 },
    comuni:   { processed: 0, failed: 0 },
    calls:    { processed: 0, failed: 0 },
  }

  const projects = await sql`
    SELECT id, title, description, amount_total, implementing_entity,
           status, category, mission, comune, watch_signals
    FROM projects
    WHERE ai_explanation IS NULL
    LIMIT ${PROJECTS_BATCH}
  `

  for (const project of projects) {
    try {
      const ai = await generateProjectExplanation(project as Parameters<typeof generateProjectExplanation>[0])
      await sql`
        UPDATE projects SET
          ai_explanation         = ${ai.explanation},
          ai_suggested_questions = ${ai.questions},
          ai_generated_at        = NOW()
        WHERE id = ${project.id}
      `
      results.projects.processed++
    } catch (err) {
      console.error(`AI generation failed for project ${project.id}:`, err)
      results.projects.failed++
    }
  }

  const comuni = await sql`
    SELECT id, nome, province, region, total_projects, total_funding, avg_project_value
    FROM comuni
    WHERE ai_summary IS NULL AND total_projects > 0
    LIMIT ${COMUNI_BATCH}
  `

  for (const comune of comuni) {
    try {
      const ai = await generateComuneSummary(comune as Parameters<typeof generateComuneSummary>[0])
      await sql`
        UPDATE comuni SET
          ai_summary              = ${ai.summary},
          ai_summary_generated_at = NOW()
        WHERE id = ${comune.id}
      `
      results.comuni.processed++
    } catch (err) {
      console.error(`AI generation failed for comune ${comune.nome}:`, err)
      results.comuni.failed++
    }
  }

  const calls = await sql`
    SELECT id, title, program, description, budget_total, deadline, categories
    FROM funding_calls
    WHERE ai_explanation IS NULL AND status = 'open'
    ORDER BY last_checked_at DESC
    LIMIT ${CALLS_BATCH}
  `

  for (const call of calls) {
    try {
      const ai = await generateCallExplanation(call as Parameters<typeof generateCallExplanation>[0])
      await sql`
        UPDATE funding_calls SET
          ai_explanation  = ${ai.explanation},
          ai_tips         = ${ai.tips},
          amount_min      = ${ai.amountMin},
          amount_max      = ${ai.amountMax},
          eligibility     = ${ai.eligibility},
          ai_generated_at = NOW()
        WHERE id = ${call.id}
      `
      results.calls.processed++
    } catch (err) {
      console.error(`AI generation failed for call ${call.id}:`, err)
      results.calls.failed++
    }
  }

  return NextResponse.json({ ok: true, version, ...results })
}
