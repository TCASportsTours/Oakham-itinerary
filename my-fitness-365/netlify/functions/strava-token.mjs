// Exchanges a Strava authorisation code, or refreshes a token, using the app's
// client secret — which must never reach the browser.
// Netlify env: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export default async function handler(req, _context, fetchImpl = fetch) {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' })
  const id = process.env.STRAVA_CLIENT_ID
  const secret = process.env.STRAVA_CLIENT_SECRET
  if (!id || !secret) return json(503, { error: 'Strava is not set up on the server yet (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET).' })
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const params = { client_id: id, client_secret: secret }
  if (body.grant_type === 'authorization_code' && typeof body.code === 'string') Object.assign(params, { grant_type: 'authorization_code', code: body.code })
  else if (body.grant_type === 'refresh_token' && typeof body.refresh_token === 'string') Object.assign(params, { grant_type: 'refresh_token', refresh_token: body.refresh_token })
  else return json(400, { error: 'Expected an authorisation code or refresh token' })

  const res = await fetchImpl('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return json(res.status, { error: data.message ?? 'Strava refused the request' })
  // Pass back only what the app needs.
  return json(200, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: data.athlete ? { id: data.athlete.id, firstname: data.athlete.firstname, lastname: data.athlete.lastname } : undefined,
  })
}
