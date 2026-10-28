// Renders public/icon.svg to the PNG icon sizes used by the manifest and iOS.
// Usage: node scripts/render-icons.mjs  (uses the Playwright Chromium already installed)
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
const targets = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-512-maskable.png', 512, 0.12],
  ['apple-touch-icon.png', 180, 0],
]
for (const [name, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size })
  const inset = Math.round(size * pad)
  await page.setContent(`<html><body style="margin:0;background:#161615"><div style="padding:${inset}px;width:${size - inset * 2}px;height:${size - inset * 2}px">${svg.replace('<svg ', `<svg width="${size - inset * 2}" height="${size - inset * 2}" `)}</div></body></html>`)
  await page.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: false })
  console.log('wrote', name)
}
await browser.close()
