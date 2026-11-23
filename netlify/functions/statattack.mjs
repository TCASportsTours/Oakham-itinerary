import { getStore } from "@netlify/blobs";
import { DECK_ID, CARDS, DECKS, BASE_AS_AT } from "../stat-attack-data.mjs";

// GCS Stat Attack — v7 — online 2-phone games.
//
// Kept completely separate from tour.mjs: its own endpoint (/.netlify/functions/statattack)
// and its own blob store ("stat-attack"), so nothing here can read or overwrite tour data.
//
// The server deals the cards and keeps both hands. Each phone only ever receives its OWN
// top card, so nobody can peek at the other player's card in the browser.
//
//   POST {action:"create", name, mode, deck}    -> new room (deck: legends|current|all), returns {room, token, seat:0}
//   POST {action:"join", room, name[, token]}   -> joins as seat 1 (or rejoins with token)
//   POST {action:"pick", room, token, stat}     -> the caller picks a stat (0-6)
//   POST {action:"rematch", room, token}        -> new deal once a game is over
//   GET  ?room=CODE&token=...                   -> that player's view of the game
//
// Card data lives in ../stat-attack-data.mjs. Current players' stats are refreshed weekly by
// stat-attack-refresh.mjs and stored under "live-stats"; each game takes a snapshot of them
// when it is dealt, so figures never change in the middle of a game.
//
//   GET  ?type=stats                            -> the latest live stats (for 1-phone games)

const QUICK_ROUNDS = 20;
const KEEP_RESULTS = 12;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // no I or O, so codes are easy to read out

export default async (req) => {
  const headers = {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  if (req.method === "OPTIONS") return new Response("", { headers });
  const store = getStore({ name: "stat-attack", consistency: "strong" });
  const url = new URL(req.url);

  try {
    if (req.method === "GET" && url.searchParams.get("type") === "stats") {
      const live = await liveStats(store);
      return reply(headers, 200, { ok: true, deckId: DECK_ID, asAt: live.asAt, cards: live.cards });
    }
    if (req.method === "GET") {
      const code = cleanCode(url.searchParams.get("room"));
      const g = code && (await load(store, code));
      if (!g) return reply(headers, 404, { ok: false, error: "Game not found" });
      return reply(headers, 200, { ok: true, game: view(g, seatOf(g, url.searchParams.get("token"))) });
    }
    if (req.method !== "POST") return reply(headers, 405, { ok: false, error: "method" });

    let b;
    try { b = await req.json(); } catch { return reply(headers, 400, { ok: false, error: "invalid JSON" }); }
    const action = String(b && b.action || "");

    if (action === "create") {
      let code = "";
      for (let i = 0; i < 12 && !code; i++) {
        const c = Array.from({ length: 4 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join("");
        if (!(await load(store, c))) code = c;
      }
      if (!code) return reply(headers, 503, { ok: false, error: "Couldn't make a game code, try again" });
      const token = newToken();
      const g = {
        code, deckId: DECK_ID, deck: DECKS[b.deck] ? b.deck : "legends",
        mode: b.mode === "full" ? "full" : "quick", max: QUICK_ROUNDS,
        status: "waiting", names: [cleanName(b.name, "Player 1"), ""], tokens: [token, null],
        hands: [[], []], pot: [], turn: 0, round: 1, gameNo: 0, results: [], wins: [0, 0],
        created: Date.now(), updated: Date.now(),
      };
      await save(store, g);
      return reply(headers, 200, { ok: true, room: code, token, seat: 0, game: view(g, 0) });
    }

    const code = cleanCode(b.room);
    const g = code && (await load(store, code));
    if (!g) return reply(headers, 404, { ok: false, error: "No game with that code" });

    if (action === "join") {
      const again = seatOf(g, b.token);
      if (again >= 0) return reply(headers, 200, { ok: true, room: code, token: b.token, seat: again, game: view(g, again) });
      if (g.tokens[1]) return reply(headers, 409, { ok: false, error: "That game already has two players" });
      const token = newToken();
      g.tokens[1] = token;
      g.names[1] = cleanName(b.name, "Player 2");
      if (g.names[1].toLowerCase() === g.names[0].toLowerCase()) g.names[1] += " 2";
      deal(g, await liveStats(store));
      await save(store, g);
      return reply(headers, 200, { ok: true, room: code, token, seat: 1, game: view(g, 1) });
    }

    const seat = seatOf(g, b.token);
    if (seat < 0) return reply(headers, 403, { ok: false, error: "You're not in this game" });

    if (action === "pick") {
      const stat = Number(b.stat);
      if (g.status !== "playing") return reply(headers, 409, { ok: false, error: "The game isn't in play" });
      if (g.turn !== seat) return reply(headers, 409, { ok: false, error: "It's not your call", game: view(g, seat) });
      if (!Number.isInteger(stat) || stat < 0 || stat >= CARDS[0].length) return reply(headers, 400, { ok: false, error: "bad stat" });
      // Guard against a double tap sending the same pick twice.
      if (b.round != null && Number(b.round) !== g.round) return reply(headers, 409, { ok: false, error: "Already played", game: view(g, seat) });
      resolve(g, stat);
      await save(store, g);
      return reply(headers, 200, { ok: true, game: view(g, seat) });
    }

    if (action === "rematch") {
      if (g.status !== "over") return reply(headers, 409, { ok: false, error: "The game is still going" });
      deal(g, await liveStats(store));
      await save(store, g);
      return reply(headers, 200, { ok: true, game: view(g, seat) });
    }

    return reply(headers, 400, { ok: false, error: "unknown action" });
  } catch (e) {
    return reply(headers, 500, { ok: false, error: "Server error" });
  }
};

function deal(g, live) {
  g.live = live.cards; g.asAt = live.asAt;   // snapshot: stats stay fixed for this game
  const d = shuffle([...DECKS[g.deck || "legends"]]);
  g.hands = [d.slice(0, d.length / 2), d.slice(d.length / 2)];
  g.pot = []; g.round = 1; g.results = []; g.status = "playing";
  g.turn = rand(2); g.gameNo += 1;
}

// Highest number wins both cards (winner's card first, then the loser's, then the pot).
// A tie puts both cards in the pot and the same player calls again.
function resolve(g, stat) {
  const a = g.hands[0].shift(), b = g.hands[1].shift();
  const va = statsOf(g, a)[stat], vb = statsOf(g, b)[stat];
  const caller = g.turn, potBefore = g.pot.length;
  let winner = null;
  if (va !== vb) {
    winner = va > vb ? 0 : 1;
    g.hands[winner].push(winner === 0 ? a : b, winner === 0 ? b : a, ...g.pot);
    g.pot = [];
    g.turn = winner;
  } else {
    g.pot.push(a, b);
  }
  g.results.push({ n: g.round, caller, stat, cards: [a, b], winner, potBefore, potAfter: g.pot.length });
  if (g.results.length > KEEP_RESULTS) g.results = g.results.slice(-KEEP_RESULTS);
  g.round += 1;
  if (!g.hands[0].length || !g.hands[1].length || (g.mode === "quick" && g.round > g.max)) {
    g.status = "over";
    const c0 = g.hands[0].length, c1 = g.hands[1].length;
    if (c0 !== c1) g.wins[c0 > c1 ? 0 : 1] += 1;
  }
}

// What one player is allowed to see: counts, names, results, and only their own top card.
function view(g, seat) {
  return {
    room: g.code, deckId: g.deckId, deck: g.deck, status: g.status, mode: g.mode, max: g.max,
    round: g.round, turn: g.turn, gameNo: g.gameNo, names: g.names, wins: g.wins,
    counts: [g.hands[0].length, g.hands[1].length], pot: g.pot.length, seat,
    myTop: seat >= 0 && g.hands[seat].length ? g.hands[seat][0] : null,
    results: g.results, live: g.live || {}, asAt: g.asAt || BASE_AS_AT,
  };
}

function statsOf(g, i) { const l = g.live && g.live[i]; return l ? l.s : CARDS[i]; }

// Latest weekly figures for current players (see stat-attack-refresh.mjs). Cached for 5 minutes
// per server instance. Before the first weekly run there is nothing stored, so the built-in
// figures (as at BASE_AS_AT) are used.
let liveCache = null, liveAt = 0;
async function liveStats(store) {
  if (liveCache && Date.now() - liveAt < 300000) return liveCache;
  let d = null;
  try { d = JSON.parse((await store.get("live-stats")) || "null"); } catch { d = null; }
  liveCache = d && d.deckId === DECK_ID && d.cards ? { asAt: d.asAt, cards: d.cards } : { asAt: BASE_AS_AT, cards: {} };
  liveAt = Date.now();
  return liveCache;
}

async function load(store, code) {
  const t = await store.get("room_" + code);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}
async function save(store, g) { g.updated = Date.now(); await store.set("room_" + g.code, JSON.stringify(g)); }
function seatOf(g, token) { return token ? g.tokens.indexOf(String(token)) : -1; }
function cleanCode(c) { const s = String(c || "").toUpperCase().replace(/[^A-Z]/g, ""); return s.length === 4 ? s : ""; }
function cleanName(n, d) { const s = String(n || "").replace(/[<>&"]/g, "").trim().slice(0, 14); return s || d; }
function newToken() { return crypto.randomUUID().replace(/-/g, ""); }
function rand(n) { return crypto.getRandomValues(new Uint32Array(1))[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function reply(headers, status, obj) { return new Response(JSON.stringify(obj), { status, headers }); }
