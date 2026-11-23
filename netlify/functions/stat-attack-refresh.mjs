import { getStore } from "@netlify/blobs";
import { DECK_ID, CARDS, CURRENT } from "../stat-attack-data.mjs";

// GCS Stat Attack — v7 — weekly refresh of CURRENT players' Test stats from ESPNcricinfo.
//
// A Netlify Scheduled Function: it only runs on the published (live) site, every Monday at
// 06:00 UTC. It never runs from a branch preview or locally, so nothing updates until the game
// goes live. It can also be started by hand from the Netlify dashboard (Functions > this
// function > "Run now").
//
// What it does:
//  1. Reads two ESPNcricinfo Statsguru tables: Test career "all-round" figures for the top 200
//     run-scorers and the top 200 wicket-takers (the same tables the cards were built from).
//  2. Finds each current player by the exact name Cricinfo uses (CURRENT in stat-attack-data.mjs).
//  3. Checks the new figures make sense before using them (see sane() below).
//  4. Saves them to the "stat-attack" store as "live-stats". New games use them straight away;
//     games already in progress keep the figures they were dealt with.
//
// Retired legends are never touched: their figures are final.
// Every run is logged under "refresh-log" (last 20 runs) so problems can be seen.

export const config = { schedule: "0 6 * * 1" };

const URLS = [
  "https://stats.espncricinfo.com/ci/engine/stats/index.html?class=1;orderby=runs;size=200;template=results;type=allround",
  "https://stats.espncricinfo.com/ci/engine/stats/index.html?class=1;orderby=wickets;size=200;template=results;type=allround",
];

export default async () => {
  const store = getStore({ name: "stat-attack", consistency: "strong" });
  const log = { at: new Date().toISOString(), ok: false, updated: [], unchanged: [], kept: [], notes: [] };
  try {
    const rows = {};
    for (const u of URLS) Object.assign(rows, parseStatsguru(await fetchText(u)));
    if (Object.keys(rows).length < 150) throw new Error("Cricinfo table looked wrong (" + Object.keys(rows).length + " rows)");

    let prev = null;
    try { prev = JSON.parse((await store.get("live-stats")) || "null"); } catch { prev = null; }
    if (prev && prev.deckId !== DECK_ID) prev = null;      // deck changed since: start again from the built-in figures
    const cards = {};

    for (const p of CURRENT) {
      const before = (prev && prev.cards[p.i]) || { s: CARDS[p.i] };
      const row = rows[p.cric];
      if (!row) { cards[p.i] = before; log.kept.push(p.name + ": not found on Cricinfo"); continue; }
      const next = toCard(row);
      const why = sane(before.s, next.s);
      if (why) { cards[p.i] = before; log.kept.push(p.name + ": " + why); continue; }
      cards[p.i] = next;
      (JSON.stringify(before.s) === JSON.stringify(next.s) ? log.unchanged : log.updated).push(p.name);
    }
    // If a lot of players went missing, Cricinfo's page has probably changed: keep last week's data.
    if (log.kept.length > CURRENT.length / 4) throw new Error("Too many players not usable, last good figures kept");

    const asAt = log.at.slice(0, 10);
    await store.set("live-stats", JSON.stringify({ deckId: DECK_ID, asAt, updated: log.at, cards }));
    log.ok = true;
    log.asAt = asAt;
  } catch (e) {
    log.notes.push(String(e && e.message || e));
  }
  await appendLog(store, log);
  return new Response(JSON.stringify(log), { headers: { "content-type": "application/json" } });
};

async function fetchText(url) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; GCSStatAttack weekly stats check)" }, redirect: "follow" });
  if (!r.ok) throw new Error("Cricinfo returned " + r.status);
  return r.text();
}

// Statsguru "Overall figures" table. Columns: Player, Span, Mat, Runs, HS, Bat Av, 100, Wkts,
// BBI, Bowl Av, 5, Ct, St, Ave Diff. Rows are keyed by the player name exactly as shown.
function parseStatsguru(html) {
  const start = html.indexOf("Overall figures");
  if (start < 0) return {};
  const t = html.slice(start);
  const head = t.slice(0, t.indexOf("</thead>"));
  const cols = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => clean(m[1]));
  const out = {};
  for (const m of t.matchAll(/<tr class="data1">([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => clean(c[1]));
    if (cells.length < cols.length - 1) continue;
    const row = {};
    cols.forEach((c, i) => { row[c] = cells[i]; });
    if (row.Player) out[row.Player] = row;
  }
  return out;
}
function clean(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").trim();
}

// Same rules the cards were built with.
function toCard(r) {
  const n = (x) => (x === "-" || x === "" || x == null ? 0 : Number(x));
  const hs = String(r.HS || "0");
  const wk = n(r.Wkts), ba = n(r["Bat Av"]), bo = n(r["Bowl Av"]);
  const ct = n(r.Ct), st = n(r.St);
  const ar = wk >= 100 && bo > 0 ? Math.round((ba / bo) * 1000) / 10 : 0;
  const card = { s: [n(r.Mat), n(r.Runs), ba, parseInt(hs, 10) || 0, wk, ct + st, ar] };
  if (hs.endsWith("*")) card.ns = 1;
  if (st > 0) { card.ct = ct; card.st = st; }
  if (wk >= 100) card.bo = bo;
  return card;
}

// Career totals can only go up, and not by much in a week. Anything else means a parsing
// problem or a different player, so that player's old figures are kept.
function sane(old, nu) {
  if (nu.some((v) => !Number.isFinite(v))) return "figures not readable";
  if (nu[0] < old[0]) return "fewer Tests than before";
  if (nu[1] < old[1]) return "fewer runs than before";
  if (nu[4] < old[4]) return "fewer wickets than before";
  if (nu[5] < old[5]) return "fewer catches than before";
  if (nu[3] < old[3]) return "lower highest score than before";
  if (nu[0] - old[0] > 6) return "too many new Tests in one week (" + (nu[0] - old[0]) + ")";
  return "";
}

async function appendLog(store, entry) {
  let all = [];
  try { all = JSON.parse((await store.get("refresh-log")) || "[]"); } catch { all = []; }
  if (!Array.isArray(all)) all = [];
  all.push(entry);
  await store.set("refresh-log", JSON.stringify(all.slice(-20)));
}
