import { expect, type Page } from '@playwright/test'

export async function skipOnboarding(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()
}

export const nav = (page: Page, tab: 'Today' | 'Diary' | 'Workouts' | 'Meals' | 'Progress') =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: tab }).click()
