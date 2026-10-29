// Read-only pass-through to the Strava API for the few endpoints the app uses,
// so the browser never depends on Strava's CORS settings. The caller's own
// access token is forwarded; nothing is stored or logged.
const ALLOWED = [/^\/athlete\/activities$/, /^\/activities\/\d+$/]
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export default async function handler(req, _context, fetchImpl = fetch) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json(401, { error: 'Missing Strava token' })

  if (req.method === 'POST' && path === '/oauth/deauthorize') {
    const res = await fetchImpl('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { authorization: auth } })
    return json(res.status, {})
  }
  if (req.method !== 'GET' || !ALLOWED.some((r) => r.test(path))) return json(400, { error: 'Endpoint not allowed' })
  const query = new URLSearchParams(url.searchParams)
  query.delete('path')
  const res = await fetchImpl(`https://www.strava.com/api/v3${path}${query.size ? `?${query}` : ''}`, { headers: { authorization: auth } })
  const body = await res.text()
  return new Response(body, { status: res.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
}
