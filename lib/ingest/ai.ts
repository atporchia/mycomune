import { GoogleGenerativeAI } from '@google/generative-ai'
import { formatEur } from '../format'

const MODEL = 'gemini-2.0-flash'

function getModel() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set')
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL })
}

export interface ProjectAI {
  explanation: string
  questions: string[]
}

export interface ComuneAI {
  summary: string
}

export async function generateProjectExplanation(project: {
  title: string
  description?: string | null
  amount_total?: number | null
  implementing_entity?: string | null
  status?: string | null
  category?: string | null
  mission?: string | null
  comune?: string | null
  watch_signals?: string[] | null
}): Promise<ProjectAI> {
  const signalNote =
    project.watch_signals && project.watch_signals.length > 0
      ? `\nNote sui dati: ${project.watch_signals.join(', ')}.`
      : ''

  const prompt = `Sei un assistente per la trasparenza dei fondi PNRR in Italia. Spiega in italiano semplice (come se stessi parlando a un cittadino curioso, senza tecnicismi) il seguente progetto PNRR.

Titolo: ${project.title}
Descrizione: ${project.description || 'non disponibile'}
Importo: ${formatEur(project.amount_total)}
Ente attuatore: ${project.implementing_entity || 'non disponibile'}
Stato: ${project.status || 'non disponibile'}
Categoria/Missione: ${project.category || project.mission || 'non disponibile'}
Comune: ${project.comune || 'non disponibile'}${signalNote}

Rispondi SOLO con questo JSON (nessun testo aggiuntivo, nessun markdown):
{
  "explanation": "Descrizione in italiano semplice di cosa fa questo progetto, a chi serve e perché è importante per i cittadini. Max 150 parole.",
  "questions": ["Una domanda utile che un cittadino potrebbe porre al Comune", "seconda domanda utile", "terza domanda utile"]
}`

  const result = await getModel().generateContent(prompt)
  const text = result.response.text().trim()

  const jsonText = text.startsWith('```')
    ? text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    : text

  const parsed = JSON.parse(jsonText) as ProjectAI

  return {
    explanation: String(parsed.explanation ?? ''),
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.slice(0, 3).map(String)
      : [],
  }
}

export async function generateComuneSummary(comune: {
  nome: string
  province?: string | null
  region?: string | null
  total_projects: number
  total_funding?: number | null
  avg_project_value?: number | null
}): Promise<ComuneAI> {
  const prompt = `Sei un assistente per la trasparenza dei fondi PNRR in Italia. Scrivi un breve riassunto in italiano semplice della situazione PNRR nel Comune.

Comune: ${comune.nome}
Provincia: ${comune.province || 'non disponibile'}
Regione: ${comune.region || 'non disponibile'}
Totale progetti PNRR: ${comune.total_projects}
Finanziamento totale: ${formatEur(comune.total_funding)}
Valore medio per progetto: ${formatEur(comune.avg_project_value)}

Rispondi SOLO con questo JSON (nessun testo aggiuntivo, nessun markdown):
{
  "summary": "Riassunto in italiano semplice (max 120 parole) della situazione PNRR nel comune. Spiega cosa significano questi numeri per i cittadini locali, quali opportunità di sviluppo rappresentano e cosa possono aspettarsi."
}`

  const result = await getModel().generateContent(prompt)
  const text = result.response.text().trim()

  const jsonText = text.startsWith('```')
    ? text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    : text

  const parsed = JSON.parse(jsonText) as ComuneAI

  return {
    summary: String(parsed.summary ?? ''),
  }
}
