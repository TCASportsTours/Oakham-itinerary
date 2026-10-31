import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { list } from '@/data/repo'
import { getTemplateDetail, previousPerformance, type TemplateDetail } from '@/services/workouts'
import { WARMUP } from '@/data/seed/workouts'
import { WEEKDAY_NAMES } from '@/lib/dates'
import { ExerciseFigure, FIGURES } from './figures'

const SHEET_VERSION = 'v1'

/** A4 wall sheets for the workouts, one page each. Route: /workouts/print/:key (key = workout_a | workout_b | workout_c | all). */
export function PrintSheets() {
  const { key = 'all' } = useParams()
  const data = useLiveQuery(async () => {
    const templates = (await list('workout_templates')).sort((a, b) => a.key.localeCompare(b.key)).filter((t) => key === 'all' || t.key === key)
    const out: { detail: TemplateDetail; last: Record<string, string> }[] = []
    for (const t of templates) {
      const detail = (await getTemplateDetail(t.id))!
      const last: Record<string, string> = {}
      for (const { exercise } of detail.items) {
        const prev = await previousPerformance(exercise.id)
        const top = prev?.sets.reduce((m, s) => Math.max(m, s.weight_kg ?? 0), 0)
        if (top) last[exercise.id] = `${top}kg`
      }
      out.push({ detail, last })
    }
    return out
  }, [key])
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const fit = () => setZoom(Math.min(1, (window.innerWidth - 24) / 794))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  if (!data) return null

  return (
    <div className="print-root">
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar">
        <Link to="/workouts" className="pt-back">← Workouts</Link>
        {import.meta.env.VITE_EMBED ? (
          <span className="pt-note">Printing isn’t available in this test page — use the PDF copies.</span>
        ) : (
          <button type="button" className="pt-print" onClick={() => window.print()}>Print {data.length > 1 ? `${data.length} pages` : 'page'}</button>
        )}
      </div>
      <div style={{ zoom }}>
        {data.map(({ detail, last }) => (
          <Sheet key={detail.template.id} detail={detail} last={last} />
        ))}
      </div>
    </div>
  )
}

function Sheet({ detail, last }: { detail: TemplateDetail; last: Record<string, string> }) {
  const [title, focus] = detail.template.name.split(' — ')
  return (
    <section className="sheet">
      <header className="sh-head">
        <div>
          <p className="sh-eyebrow">{WEEKDAY_NAMES[detail.template.default_weekday]} · {detail.template.duration_text}</p>
          <h1 className="sh-title">{title}</h1>
          <p className="sh-focus">{focus}</p>
        </div>
        <div className="sh-brand">
          <span className="sh-365">365</span>
          <span>My Fitness 365</span>
        </div>
      </header>

      <p className="sh-warm"><strong>Warm-up (5 min):</strong> {WARMUP.slice(0, 3).map((w) => w.replace(/\.$/, '')).join(' · ')}.</p>

      <ol className="sh-list">
        {detail.items.map(({ te, exercise }, i) => {
          const fig = FIGURES[exercise.key]
          const reps = `${te.reps_min === te.reps_max ? te.reps_min : `${te.reps_min}–${te.reps_max}`}${te.rep_unit === 'seconds' ? ' sec' : ' reps'}${te.per_side ? ' each side' : ''}`
          return (
            <li key={te.id} className="sh-row">
              <div className="sh-fig">
                <ExerciseFigure exerciseKey={exercise.key} title={exercise.name} className="sh-svg" />
              </div>
              <div className="sh-info">
                <h2 className="sh-name"><span className="sh-num">{i + 1}</span>{exercise.name}</h2>
                <p className="sh-dose"><strong>{te.sets} × {reps}</strong> · rest {te.rest_seconds}s</p>
                <p className="sh-weight">Start weight: <strong>{te.suggested_weight}</strong>{last[exercise.id] && <> · last used <strong>{last[exercise.id]}</strong></>}</p>
                {fig && <p className="sh-cue">{fig.caption.filter(Boolean).join(' → ')}.</p>}
                {exercise.common_mistakes[0] && <p className="sh-avoid">Avoid: {exercise.common_mistakes[0].split(' — ')[0].split(', which')[0].replace(/\.$/, '').toLowerCase()}.</p>}
                <div className="sh-log" aria-label="Weight used each week">
                  {Array.from({ length: 8 }, (_, w) => (
                    <span key={w} className="sh-box"><span>W{w + 1}</span></span>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <footer className="sh-foot">
        <p><strong>Every set:</strong> stop with 2–3 reps left in the tank · controlled lowering · breathe out on the effort · stop for any sharp pain.</p>
        <p className="sh-ver">Write the weight you used in the week boxes · {detail.template.key.replace('workout_', 'Workout ').toUpperCase()} sheet {SHEET_VERSION}</p>
      </footer>
    </section>
  )
}

/** Paper styles: white page, GCS accents, ink-friendly diagrams. */
const PRINT_CSS = `
.print-root { background: #e9e9e4; min-height: 100dvh; padding: 12px; color: #161615; }
.print-toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; max-width: 794px; margin: 0 auto 12px; font-family: 'Josefin Sans', sans-serif; }
.pt-back { color: #161615; font-weight: 600; min-height: 44px; display: inline-flex; align-items: center; }
.pt-print { background: #51cea7; color: #0b2a20; font-weight: 700; border-radius: 12px; padding: 10px 18px; min-height: 44px; }
.pt-note { font-size: 13px; color: #555; }
.sheet { --fig-near: #161615; --fig-far: #8f8f88; --fig-prop: #cfcfc8; --fig-db: #7777c9; --fig-accent: #ff7c1a; --fig-text: #6b6b65;
  width: 210mm; height: 297mm; box-sizing: border-box; padding: 11mm 12mm 9mm; margin: 0 auto 16px; background: #fff; color: #161615;
  font-family: 'Josefin Sans', sans-serif; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 12px rgb(0 0 0 / .12);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sh-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #51cea7; padding-bottom: 3mm; }
.sh-eyebrow { font-size: 11pt; font-weight: 600; color: #ff7c1a; text-transform: uppercase; letter-spacing: .08em; margin: 0; }
.sh-title { font-size: 26pt; font-weight: 700; font-style: italic; line-height: 1; margin: 1mm 0 0; }
.sh-focus { font-size: 15pt; font-weight: 600; margin: 1mm 0 0; color: #3a3a37; }
.sh-brand { display: flex; flex-direction: column; align-items: flex-end; font-size: 9pt; color: #6b6b65; gap: 1mm; }
.sh-365 { background: #161615; color: #fff; font-weight: 700; font-style: italic; font-size: 13pt; border-radius: 3mm; padding: 1.5mm 3mm; border: 2px solid #51cea7; }
.sh-warm { font-size: 9pt; margin: 2.5mm 0 2mm; color: #3a3a37; line-height: 1.35; }
.sh-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2mm; flex: 1; }
.sh-row { display: grid; grid-template-columns: 70mm 1fr; gap: 4mm; align-items: center; border: 1px solid #e2e2dc; border-radius: 3mm; padding: 1.5mm 3mm; flex: 1 1 0; min-height: 0; }
.sh-fig { display: flex; align-items: center; }
.sh-svg { width: 100%; height: 31mm; }
.sh-name { font-size: 12.5pt; font-weight: 700; margin: 0; display: flex; gap: 2mm; align-items: baseline; }
.sh-num { background: #51cea7; color: #0b2a20; border-radius: 50%; width: 6.5mm; height: 6.5mm; display: inline-flex; align-items: center; justify-content: center; font-size: 10pt; flex: none; }
.sh-dose { font-size: 12pt; margin: .6mm 0 0; }
.sh-weight { font-size: 9.5pt; margin: .5mm 0 0; color: #3a3a37; }
.sh-cue { font-size: 8.5pt; margin: .5mm 0 0; color: #3a3a37; line-height: 1.25; }
.sh-avoid { font-size: 8.5pt; margin: .3mm 0 0; line-height: 1.25; color: #b4500a; }
.sh-log { display: grid; grid-template-columns: repeat(8, 1fr); gap: 1.2mm; margin-top: 1.2mm; }
.sh-box { border: 1px solid #b9b9b2; border-radius: 1.5mm; height: 6mm; position: relative; }
.sh-box span { position: absolute; top: .4mm; left: 1mm; font-size: 6.5pt; color: #8f8f88; }
.sh-foot { border-top: 1px solid #e2e2dc; margin-top: 3mm; padding-top: 2mm; font-size: 9pt; color: #3a3a37; }
.sh-foot p { margin: 0 0 1mm; }
.sh-ver { color: #8f8f88; font-size: 8pt; }
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .print-root { background: #fff; padding: 0; }
  .print-toolbar { display: none; }
  .print-root > div { zoom: 1 !important; }
  .sheet { margin: 0; box-shadow: none; page-break-after: always; break-after: page; }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
}
`
