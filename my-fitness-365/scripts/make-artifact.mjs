// Turns dist-artifact/ into a claude.ai page: CSS (with fonts as data URIs) inlined
// into artifact-page/index.html; JS chunks published alongside as supporting files.
import { readFile, writeFile, mkdir, readdir, cp, rm } from 'node:fs/promises'
import { join } from 'node:path'

const dist = new URL('../dist-artifact/', import.meta.url).pathname
const out = new URL('../artifact-page/', import.meta.url).pathname
const html = await readFile(join(dist, 'index.html'), 'utf8')
const cssHref = html.match(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"/)[1]
const jsSrc = html.match(/<script type="module"[^>]*src="\.\/([^"]+)"/)[1]
let css = await readFile(join(dist, cssHref), 'utf8')
const cssDir = join(dist, cssHref, '..')
const mime = { woff2: 'font/woff2', woff: 'font/woff' }
for (const m of [...css.matchAll(/url\((?:\.\/)?([^)"']+\.(woff2?))\)/g)]) {
  const data = await readFile(join(cssDir, m[1]))
  css = css.replaceAll(m[0], `url(data:${mime[m[2]]};base64,${data.toString('base64')})`)
}
const page = `<title>My Fitness 365</title>
<meta name="theme-color" content="#161615">
<style>${css}</style>
<div id="root"></div>
<script type="module" src="./${jsSrc}"></script>
`
await rm(out, { recursive: true, force: true })
await mkdir(join(out, 'assets'), { recursive: true })
await writeFile(join(out, 'index.html'), page)
const js = (await readdir(join(dist, 'assets'))).filter((f) => f.endsWith('.js'))
for (const f of js) await cp(join(dist, 'assets', f), join(out, 'assets', f))
console.log(`page ${(page.length / 1024).toFixed(0)} KB; scripts: ${js.join(', ')}`)
