import { it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { writeFileSync } from 'node:fs'
import { ExerciseFigure, FIGURES } from '@/features/workouts/figures'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
// Diagnostic only: FIGS=/path/out.html npx vitest run src/dev/figures-preview.test.tsx
it.skipIf(!env.FIGS)('renders every exercise diagram to an HTML sheet', () => {
  const body = Object.keys(FIGURES)
    .map((k) => `<div style="margin:8px;padding:8px;border:1px solid #333;width:360px;display:inline-block"><div style="font:14px sans-serif;color:#ccc">${k}</div>${renderToStaticMarkup(<ExerciseFigure exerciseKey={k} className="w" />)}</div>`)
    .join('')
  writeFileSync(env.FIGS!, `<html><body style="background:#161615">${body}</body></html>`)
})
