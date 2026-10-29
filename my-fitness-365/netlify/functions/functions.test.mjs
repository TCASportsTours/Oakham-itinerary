// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import token from './strava-token.mjs'
import api from './strava-api.mjs'

afterEach(() => {
  delete process.env.STRAVA_CLIENT_ID
  delete process.env.STRAVA_CLIENT_SECRET
})

const post = (body) => new Request('https://app.test/.netlify/functions/strava-token', { method: 'POST', body: JSON.stringify(body) })

describe('strava-token function', () => {
  it('reports clearly when the secret is not configured', async () => {
    const res = await token(post({ grant_type: 'authorization_code', code: 'x' }))
    expect(res.status).toBe(503)
  })
  it('adds the server-side secret and returns only the needed fields', async () => {
    process.env.STRAVA_CLIENT_ID = '123'
    process.env.STRAVA_CLIENT_SECRET = 'shh'
    let sent
    const fake = async (_url, init) => {
      sent = JSON.parse(init.body)
      return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: 9, athlete: { id: 1, firstname: 'C', city: 'Leeds' }, extra: 1 }))
    }
    const res = await token(post({ grant_type: 'authorization_code', code: 'abc' }), {}, fake)
    expect(sent).toEqual({ client_id: '123', client_secret: 'shh', grant_type: 'authorization_code', code: 'abc' })
    const body = await res.json()
    expect(body).toEqual({ access_token: 'a', refresh_token: 'r', expires_at: 9, athlete: { id: 1, firstname: 'C' } })
    expect(JSON.stringify(body)).not.toContain('shh')
  })
  it('rejects anything else', async () => {
    process.env.STRAVA_CLIENT_ID = '1'
    process.env.STRAVA_CLIENT_SECRET = '2'
    expect((await token(post({ grant_type: 'password' }))).status).toBe(400)
    expect((await token(new Request('https://app.test/x'))).status).toBe(405)
  })
})

describe('strava-api function', () => {
  const get = (path, auth = 'Bearer t') => new Request(`https://app.test/.netlify/functions/strava-api?path=${encodeURIComponent(path)}&per_page=50`, { headers: auth ? { authorization: auth } : {} })
  it('forwards allowed read requests with the caller’s token', async () => {
    let called
    const fake = async (url, init) => {
      called = { url, auth: init.headers.authorization }
      return new Response('[]')
    }
    const res = await api(get('/athlete/activities'), {}, fake)
    expect(res.status).toBe(200)
    expect(called).toEqual({ url: 'https://www.strava.com/api/v3/athlete/activities?per_page=50', auth: 'Bearer t' })
  })
  it('refuses other endpoints and missing tokens', async () => {
    const fake = async () => new Response('{}')
    expect((await api(get('/athlete'), {}, fake)).status).toBe(400)
    expect((await api(get('/activities/1/streams'), {}, fake)).status).toBe(400)
    expect((await api(get('/athlete/activities', ''), {}, fake)).status).toBe(401)
  })
})
