// Renders the A4 wall sheets to PDF from a running preview (npm run preview).
// Usage: node scripts/print-sheets.mjs [baseUrl] [outDir]
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4173'
const out = process.argv[3] ?? new URL('../docs/print/', import.meta.url).pathname
const files = [
  ['workout_a', 'Workout-A-Chest-Shoulders-Monday_v1.pdf'],
  ['workout_b', 'Workout-B-Back-Arms-Abs-Wednesday_v1.pdf'],
  ['workout_c', 'Workout-C-Chest-Full-Body-Friday_v1.pdf'],
  ['all', 'Workouts-A-B-C-wall-sheets_v1.pdf'],
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })
await page.goto(base + '/')
await page.getByRole('button', { name: 'Skip setup' }).click()
for (const [key, name] of files) {
  await page.goto(`${base}/workouts/print/${key}`)
  await page.locator('.sheet').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: out + name, format: 'A4', printBackground: true, preferCSSPageSize: true })
  await page.emulateMedia({ media: 'screen' })
  console.log('wrote', name)
}
await browser.close()
