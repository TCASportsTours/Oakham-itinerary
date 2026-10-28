import { test, expect } from '@playwright/test'
import { skipOnboarding } from './helpers'

test('manifest is valid for installation', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest')
  expect(res.ok()).toBe(true)
  const m = await res.json()
  expect(m.name).toBe('My Fitness 365')
  expect(m.short_name).toBe('Fitness 365')
  expect(m.display).toBe('standalone')
  expect(m.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true)
  for (const icon of m.icons) expect((await request.get('/' + icon.src)).ok()).toBe(true)
  expect((await request.get('/apple-touch-icon.png')).ok()).toBe(true)
  expect((await request.get('/offline.html')).ok()).toBe(true)
})

test('works offline after first load, and offline workout sets persist', async ({ page, context }) => {
  await skipOnboarding(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload() // let the SW take control
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.goto('/workouts')
  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText(/Offline/)).toBeVisible()
  await page.getByRole('link', { name: /Workout C/ }).click()
  await page.getByRole('button', { name: 'Start workout today' }).click()
  await page.getByLabel('Weight in kg for set 1').fill('6')
  await page.getByRole('button', { name: 'Mark set 1 done' }).click()
  await page.reload()
  await expect(page.getByLabel('Weight in kg for set 1')).toHaveValue('6')
  await context.setOffline(false)
})

test('no privileged keys are shipped in the bundle', async ({ page, request }) => {
  await page.goto('/')
  const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).src))
  for (const src of scripts) {
    const body = await (await request.get(src)).text()
    expect(body).not.toMatch(/service_role/)
    expect(body).not.toMatch(/SUPABASE_SERVICE/)
  }
})
