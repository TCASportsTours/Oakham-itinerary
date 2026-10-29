import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { skipOnboarding, nav } from './helpers'

const ICON = fileURLToPath(new URL('../public/icon-512.png', import.meta.url))

test('onboarding records a fresh weight in stones and pounds', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Stones').fill('13')
  await page.getByLabel('Pounds').fill('12')
  await page.getByRole('button', { name: 'Save weight' }).click()
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await expect(page.getByText('13st 12lb').first()).toBeVisible()
  await expect(page.getByText(/since your 14st 0lb baseline/)).toBeVisible()
})

test('diary: add, combine and reschedule activities; changes survive reload', async ({ page }) => {
  await skipOnboarding(page)
  await nav(page, 'Diary')
  await page.getByRole('button', { name: /^Monday/ }).first().click()
  await expect(page.getByText('Workout A — Chest & Shoulders')).toBeVisible()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: /Social evening/ }).click()
  await expect(page.getByText('Social evening')).toBeVisible()
  // reschedule Workout A to the next day
  await page.getByRole('button', { name: 'Options for Workout A — Chest & Shoulders' }).click()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(page.getByText('Cancelled')).toBeVisible()
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByText(/Moved from/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Moved from/)).toBeVisible()
  // notes
  await page.getByLabel('Notes', { exact: true }).fill('Legs tired')
  await page.getByRole('button', { name: 'Save notes' }).click()
  await expect(page.getByRole('button', { name: 'Saved ✓' })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Legs tired')
})

test('workout: start Workout A, log sets, finish, see it in history after reload', async ({ page }) => {
  await skipOnboarding(page)
  await nav(page, 'Workouts')
  await page.getByRole('link', { name: /Workout A — Chest & Shoulders/ }).click()
  await page.getByRole('button', { name: 'Start workout today' }).click()
  await expect(page.getByRole('heading', { name: 'Exercise 1 of 5' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Flat dumbbell chest press' })).toBeVisible()
  // instructions + video
  await expect(page.getByText(/Lower the dumbbells slowly/)).toBeVisible()
  await page.getByText('Video demonstration').click()
  await expect(page.getByText(/Video unavailable/)).toBeVisible()
  await page.getByLabel('Weight in kg for set 1').fill('8')
  await page.getByLabel('Reps for set 1').fill('11')
  await page.getByRole('button', { name: 'Mark set 1 done' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  // close and resume
  await page.reload()
  await expect(page.getByLabel('Weight in kg for set 1')).toHaveValue('8')
  await expect(page.getByRole('button', { name: 'Mark set 1 not done' })).toBeVisible()
  await page.getByRole('button', { name: /^Next/ }).click()
  await expect(page.getByRole('heading', { name: 'Exercise 2 of 5' })).toBeVisible()
  await page.getByRole('button', { name: 'Finish' }).first().click()
  await page.getByRole('button', { name: 'Save workout' }).click()
  await expect(page.getByText(/Set 1: 8kg × 11 ✓/)).toBeVisible()
  await page.reload()
  await page.goto('/workouts?tab=history')
  await expect(page.getByText('Workout A — Chest & Shoulders')).toBeVisible()
  // previous performance shows next time
  await page.goto('/workouts?tab=programme')
  await page.getByRole('link', { name: /Workout A — Chest & Shoulders/ }).click()
  await expect(page.getByText('Last: 8kg × 11')).toBeVisible()
})

test('ride: record a mountain bike ride', async ({ page }) => {
  await skipOnboarding(page)
  await page.getByRole('button', { name: 'Record ride' }).click()
  await page.getByLabel('Duration (min)').fill('90')
  await page.getByLabel('Distance (km)').fill('28.5')
  await expect(page.getByText(/MET 8.5 ×/)).toBeVisible()
  await page.getByRole('button', { name: 'Save ride' }).click()
  await expect(page.getByRole('button', { name: 'Save ride' })).toHaveCount(0) // sheet closes once the ride is stored
  await page.goto('/workouts?tab=rides')
  await expect(page.getByText(/90 min · 28.5 km/)).toBeVisible()
})

test('meals: plan, swap dinner, log what was eaten, shopping list', async ({ page }) => {
  await skipOnboarding(page)
  await nav(page, 'Meals')
  await page.getByRole('button', { name: 'Suggest day' }).click()
  const dinnerSection = page.getByRole('group', { name: 'Dinner', exact: true })
  const dinnerName = await dinnerSection.locator('a p').first().textContent()
  await dinnerSection.getByRole('button', { name: /^Swap / }).click()
  await expect(dinnerSection.locator('a p').first()).not.toHaveText(dinnerName!)
  // choose a specific chicken dinner
  await dinnerSection.getByRole('button', { name: /^Change / }).click()
  await page.getByLabel('Search recipes').fill('Lemon chicken')
  await page.locator('dialog[open]').getByRole('button', { name: /Lemon chicken with steamed vegetables/ }).click()
  await expect(dinnerSection.getByText('Lemon chicken with steamed vegetables')).toBeVisible()
  // planned ≠ eaten until logged
  await expect(page.getByText('Nothing logged yet.', { exact: false })).toBeVisible()
  await dinnerSection.getByRole('button', { name: /Log Lemon chicken/ }).click()
  await expect(dinnerSection.getByText('Eaten', { exact: true })).toBeVisible()
  await expect(page.locator('section', { hasText: 'Actually eaten' }).getByText('Lemon chicken with steamed vegetables')).toBeVisible()
  // weekly menu + shopping list
  await page.getByRole('button', { name: 'Fill the next 7 days' }).click()
  await page.getByRole('radio', { name: 'Shopping' }).click()
  await page.getByRole('button', { name: 'Generate shopping list' }).click()
  await expect(page.getByRole('heading', { name: 'Meat and fish' })).toBeVisible()
  await expect(page.getByText('Chicken breast fillets')).toBeVisible()
  const item = page.getByRole('checkbox', { name: 'Got Chicken breast fillets' })
  await item.check()
  // the write is async (IndexedDB); wait for it to land before reloading
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((res) => {
    const req = indexedDB.open('my-fitness-365')
    req.onsuccess = () => {
      const all = req.result.transaction('shopping_list_items').objectStore('shopping_list_items').getAll()
      all.onsuccess = () => res(all.result.some((i: { name: string; checked: boolean }) => i.name === 'Chicken breast fillets' && i.checked))
    }
  }))).toBe(true)
  await page.reload()
  await page.getByRole('radio', { name: 'Shopping' }).click()
  await expect(page.getByRole('checkbox', { name: 'Got Chicken breast fillets' })).toBeChecked()
})

test('progress: weight in st/lb, waist/chest/shoulders, private photos and comparison', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/progress/weight?add=1')
  await page.getByLabel('Stones').fill('13')
  await page.getByLabel('Pounds').fill('10')
  await page.getByRole('button', { name: 'Save weight' }).click()
  await expect(page.getByText('13st 10lb (87.1kg)')).toBeVisible()

  await page.goto('/progress/measurements?add=1')
  await page.getByLabel('Waist at navel', { exact: true }).fill('101.5')
  await page.getByLabel('Chest', { exact: true }).fill('108')
  await page.getByLabel('Shoulders', { exact: true }).fill('121')
  await expect(page.getByText(/How to measure your waist at navel/)).toBeVisible()
  await page.getByRole('button', { name: 'Save 3 measurements' }).click()
  await expect(page.getByRole('heading', { name: 'Waist at navel' })).toBeVisible()
  await expect(page.getByText('101.5cm').first()).toBeVisible()

  // Two photo dates for comparison
  for (const date of ['2026-09-30', '2026-10-28']) {
    await page.goto('/progress/photos/new')
    await page.getByLabel('Date').fill(date)
    for (const view of ['Front', 'Side', 'Back']) {
      await page.getByLabel('Upload photo from library').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: readFileSync(ICON) })
      await expect(page.getByAltText('Preview of adjusted photo')).toBeVisible()
      await page.getByRole('button', { name: `Save ${view.toLowerCase()}` }).click()
      if (view !== 'Back') await expect(page.getByRole('radio', { name: `${view} ✓` })).toBeVisible()
    }
    await expect(page).toHaveURL(/\/progress\/photos$/)
  }
  await expect(page.getByAltText(/Front progress photo, 30\/09\/2026/)).toBeVisible()
  await page.getByRole('link', { name: 'Compare' }).click()
  await expect(page.getByAltText(/Front progress photo, 30\/09\/2026/)).toBeVisible()
  await expect(page.getByAltText(/Front progress photo, 28\/10\/2026/)).toBeVisible()
  await page.getByRole('radio', { name: 'Slider' }).click()
  await page.getByRole('radio', { name: 'Overlay' }).click()
  await expect(page.getByText(/Later photo opacity/)).toBeVisible()
  // Delete removes the photo
  await page.goto('/progress/photos')
  await page.getByRole('button', { name: 'Delete Back photo from 30/09/2026' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByAltText(/Back progress photo, 30\/09\/2026/)).toHaveCount(0)
})

test('export: JSON download contains recorded data', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/progress/weight?add=1')
  await page.getByLabel('Stones').fill('14')
  await page.getByRole('button', { name: 'Save weight' }).click()
  await page.goto('/settings')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'All data (JSON)' }).click()])
  const json = JSON.parse(readFileSync((await download.path())!, 'utf8'))
  expect(json.app).toBe('my-fitness-365')
  expect(json.tables.weight_entries).toHaveLength(1)
  expect(json.tables.weight_entries[0].weight_kg).toBeCloseTo(88.904, 2)
})

test('settings: ride calories count by default; Strava waits for set-up', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/settings')
  await expect(page.getByRole('checkbox', { name: 'Add ride calories to my food allowance' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Strava rides' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Not set up yet')).toBeVisible()
})
