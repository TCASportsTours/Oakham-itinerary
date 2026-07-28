import { getStore } from "@netlify/blobs";

// One endpoint, several independent slots — each stored under its own key so
// they can NEVER overwrite each other:
//
//   /tour                  -> published itinerary       (key "current")
//   /tour?type=alerts      -> alerts list               (key "alerts")
//   /tour?type=checkins    -> check-in register         (key "checkins")
//   /tour?type=votes       -> Players' Player votes      (key "votes")
//   /tour?type=preorders   -> meal pre-orders            (key "preorders")
//   /tour?type=feedback    -> app feedback for staff      (key "feedback")
//
//   GET  -> returns whatever is stored for that slot, with a sensible empty
//           default if nothing is there yet (null for the tour, [] for alerts,
//           {} for everything else). It never hands back the wrong shape — this
//           is what fixes the "[object Object] / dates" vote results.
//   POST -> saves the body. The itinerary and alerts are replaced wholesale;
//           votes, pre-orders and check-ins are MERGED by their top-level keys
//           so two phones submitting at the same moment can't wipe each other.

const MERGE = new Set(["checkins", "votes", "preorders", "lineups", "feedback", "departures"]);

export default async (req) => {
  const headers = {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS, DELETE",
    "access-control-allow-headers": "content-type",
  };

  if (req.method === "OPTIONS") return new Response("", { headers });

  // STRONG consistency: every read returns the most recent write, in every region.
  // Without this, Netlify Blobs is eventually-consistent — a publish succeeds but a
  // read from another region can keep returning an older copy, which is what made the
  // app (and admin on reload) "revert" to a previously-published dataset.
  // Same store name as before, so all existing data is preserved.
  const store = getStore({ name: "parkside-tour", consistency: "strong" });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "";
  const key = type ? type : "current";            // "current" = the published itinerary

  // DELETE: wipe a test-data slot back to empty so a tour can be re-tested from scratch.
  // Restricted to the submission slots so a stray/hostile call can NEVER clear the published tour.
  if (req.method === "DELETE") {
    // Feedback can be removed one entry at a time (?id=...) or cleared wholesale.
    if (type === "feedback") {
      const id = url.searchParams.get("id");
      if (id) {
        let cur = {};
        try { cur = JSON.parse((await store.get(key)) || "{}"); } catch { cur = {}; }
        if (!cur || typeof cur !== "object" || Array.isArray(cur)) cur = {};
        delete cur[id];
        await store.set(key, JSON.stringify(cur));
        return reply(headers, 200, { ok: true, deleted: id });
      }
      await store.set(key, "{}");
      return reply(headers, 200, { ok: true, cleared: key });
    }
    const RESETTABLE = new Set(["votes", "preorders", "checkins", "stats"]);
    if (!RESETTABLE.has(type)) return reply(headers, 400, { ok: false, error: "refused: that slot can't be cleared" });
    await store.set(key, "{}");
    return reply(headers, 200, { ok: true, cleared: key });
  }

  if (req.method === "POST") {
    const text = await req.text();

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return reply(headers, 400, { ok: false, error: "invalid JSON" }); }

    // --- Itinerary: must look like a real tour object, never an array/empty blob. ---
    if (!type) {
      const looksLikeTour =
        parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.events);
      if (!looksLikeTour) return reply(headers, 400, { ok: false, error: "refused: not a tour object" });
      await store.set(key, text);
      return reply(headers, 200, { ok: true });
    }

    // --- Alerts: must be an array. Replaced wholesale. ---
    if (type === "alerts") {
      if (!Array.isArray(parsed)) return reply(headers, 400, { ok: false, error: "refused: alerts must be a list" });
      await store.set(key, text);
      return reply(headers, 200, { ok: true });
    }

    // --- Scheduled alerts: a queue of alerts to release later. Array, replaced wholesale.
    //     Each item carries a sendAt (ms epoch). Due items move into the live alerts list
    //     automatically on the next alerts GET (see below), so no cron is needed. To delete
    //     one before it sends, POST the filtered list. ---
    if (type === "scheduled") {
      if (!Array.isArray(parsed)) return reply(headers, 400, { ok: false, error: "refused: scheduled must be a list" });
      await store.set(key, text);
      return reply(headers, 200, { ok: true });
    }

    // --- stats: analytics counters (logins + tile usage), incremented server-side so
    //     many phones can't clobber the totals. Never holds any personal data beyond
    //     a player's own name (supporters are counted by team only). ---
    if (type === "stats") {
      let cur = {};
      try { cur = JSON.parse((await store.get(key)) || "{}"); } catch { cur = {}; }
      if (!cur || typeof cur !== "object" || Array.isArray(cur)) cur = {};
      cur.logins = cur.logins || { players: {}, supporters: {}, staff: {} };
      cur.tiles = cur.tiles || {};
      const role = String(parsed.role || "player");
      const team = String(parsed.team || "\u2014");
      if (parsed.kind === "login") {
        if (role === "supporter") cur.logins.supporters[team] = (cur.logins.supporters[team] || 0) + 1;
        else if (role === "staff") { const k = team + " \u00b7 " + (parsed.player || "Staff"); cur.logins.staff[k] = (cur.logins.staff[k] || 0) + 1; }
        else { const k = team + " \u00b7 " + (parsed.player || "(unnamed)"); cur.logins.players[k] = (cur.logins.players[k] || 0) + 1; }
      } else if (parsed.kind === "tile") {
        const tile = String(parsed.tile || "\u2014");
        cur.tiles[team] = cur.tiles[team] || {};
        cur.tiles[team][tile] = cur.tiles[team][tile] || { player: 0, supporter: 0, staff: 0 };
        cur.tiles[team][tile][role] = (cur.tiles[team][tile][role] || 0) + 1;
      } else if (parsed.kind === "link") {
        const label = String(parsed.link || "\u2014");
        cur.links = cur.links || {};
        cur.links[label] = cur.links[label] || { player: 0, supporter: 0, staff: 0 };
        cur.links[label][role] = (cur.links[label][role] || 0) + 1;
      }
      await store.set(key, JSON.stringify(cur));
      return reply(headers, 200, { ok: true });
    }

    // --- checkins / votes / preorders (and any future object slot): must be an object. ---
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return reply(headers, 400, { ok: false, error: "refused: expected an object" });
    }

    if (MERGE.has(type)) {
      // Merge this submission into whatever is already stored, by top-level key
      // (the per-device id for votes/pre-orders). Keeps everyone else's entries,
      // so concurrent submissions don't clobber each other.
      let cur = {};
      try { cur = JSON.parse((await store.get(key)) || "{}"); } catch { cur = {}; }
      if (!cur || typeof cur !== "object" || Array.isArray(cur)) cur = {};
      for (const k of Object.keys(parsed)) cur[k] = parsed[k];
      await store.set(key, JSON.stringify(cur));
    } else {
      await store.set(key, text);
    }
    return reply(headers, 200, { ok: true });
  }

  // --- GET ---
  // Auto-release due scheduled alerts whenever the alerts list is fetched. Every client
  // polls alerts about once a minute, so a scheduled alert fires close to its time with
  // no cron. Due items lose their sendAt and become normal alerts on top of the list.
  if (type === "alerts") {
    try {
      let sched = JSON.parse((await store.get("scheduled")) || "[]");
      if (Array.isArray(sched) && sched.length) {
        const now = Date.now();
        const due = sched.filter((a) => a && a.sendAt && a.sendAt <= now);
        if (due.length) {
          let alerts = JSON.parse((await store.get("alerts")) || "[]");
          if (!Array.isArray(alerts)) alerts = [];
          due.sort((a, b) => a.sendAt - b.sendAt).forEach((a) => {
            const rest = Object.assign({}, a); delete rest.sendAt;
            alerts.unshift(rest);
          });
          alerts = alerts.slice(0, 20);
          const remaining = sched.filter((a) => !(a && a.sendAt && a.sendAt <= now));
          await store.set("alerts", JSON.stringify(alerts));
          await store.set("scheduled", JSON.stringify(remaining));
        }
      }
    } catch {}
  }
  const data = await store.get(key);
  if (data != null) return new Response(data, { headers });
  const empty = !type ? "null" : (type === "alerts" || type === "scheduled" ? "[]" : "{}");
  return new Response(empty, { headers });
};

function reply(headers, status, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}
