import express from "express";
import { db, getLatestAthlete, getTokens, upsertActivity, listActivities } from "../db/db.js";
import { refreshAccessToken } from "./auth.js";

const router = express.Router();

async function getValidAccessToken() {
  const athlete = getLatestAthlete();
  if (!athlete) throw new Error("Brak połączonego konta Stravy. Wejdź na /auth/strava/login");

  const nowSec = Math.floor(Date.now() / 1000);
  if (athlete.expires_at <= nowSec + 60) {
    return await refreshAccessToken(athlete);
  }
  return athlete.access_token;
}

/**
 * Synchronizacja: pobiera aktywności ze Stravy (GET /athlete/activities)
 * i zapisuje lokalnie. Endpoint TYLKO odczytuje z API Stravy — żadne
 * wywołanie w tym pliku nie modyfikuje ani nie usuwa danych na Stravie.
 */
async function doSync() {
  const token = await getValidAccessToken();
  const athlete = getLatestAthlete();

  // Synchronizacja przyrostowa: jeśli mamy już jakieś aktywności w bazie,
  // pobieramy tylko te NOWSZE niż ostatnia zapisana (parametr "after" Stravy).
  const newest = db
    .prepare("SELECT start_date FROM activities WHERE athlete_id = ? ORDER BY start_date DESC LIMIT 1")
    .get(athlete.athlete_id);
  const afterParam = newest
    ? `&after=${Math.floor(new Date(newest.start_date).getTime() / 1000)}`
    : "";

  let page = 1;
  let total = 0;
  const perPage = 100;
  const maxPages = 50; // ~500 ostatnich aktywności, wystarczające do CTL/ATL (42 dni) z zapasem

  while (page <= maxPages) {
    const r = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}${afterParam}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) throw new Error(`Strava API error: ${r.status} ${await r.text()}`);
    const batch = await r.json();
    if (batch.length === 0) break;

    batch.forEach((a) => upsertActivity(athlete.athlete_id, a));
    total += batch.length;
    page++;
    if (batch.length < perPage) break;
  }

  return total;
}

router.post("/sync", async (req, res) => {
  try {
    const total = await doSync();
    res.json({ ok: true, synced: total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Wersja GET — działa po prostu po wejściu na adres w przeglądarce,
// bez potrzeby żadnych dodatkowych narzędzi.
router.get("/sync", async (req, res) => {
  try {
    const total = await doSync();
    res.send(`Zsynchronizowano ${total} aktywności ze Stravy ✓ (możesz zamknąć tę kartę)`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Błąd synchronizacji: " + e.message);
  }
});

/**
 * Zwraca lokalnie zapisane aktywności w formacie gotowym dla silnika
 * CTL/ATL/TSB z aplikacji frontendowej (pole tss ≈ suffer_score Stravy,
 * z fallbackiem na oszacowanie z czasu trwania i tętna).
 */
router.get("/", (req, res) => {
  const athlete = getLatestAthlete();
  if (!athlete) return res.status(400).json({ error: "Brak połączonego konta Stravy" });

  const rows = listActivities(athlete.athlete_id, 500);
  const mapped = rows.map((r) => ({
    id: String(r.id),
    date: r.start_date?.slice(0, 10),
    discipline: mapType(r.type),
    durationMin: Math.round((r.moving_time || 0) / 60),
    tss: estimateTSS(r),
    avgHr: r.average_heartrate ? Math.round(r.average_heartrate) : null,
    elevGain: r.total_elevation_gain ? Math.round(r.total_elevation_gain) : 0,
    source: "strava",
  }));
  res.json(mapped);
});

function mapType(stravaType) {
  const t = (stravaType || "").toLowerCase();
  if (t.includes("run")) return "Bieganie";
  if (t.includes("ride") || t.includes("mountainbike") || t.includes("gravel")) return "MTB";
  return "Inne";
}

// Jeśli Strava poda suffer_score (Relative Effort), użyj go jako proxy TSS.
// W przeciwnym razie prosty szacunek: czas [min] * współczynnik intensywności z HR.
function estimateTSS(r) {
  if (r.suffer_score) return Math.round(r.suffer_score);
  const durationMin = (r.moving_time || 0) / 60;
  const hrFactor = r.average_heartrate ? clamp(r.average_heartrate / 150, 0.5, 1.4) : 0.8;
  return Math.round(durationMin * hrFactor);
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export default router;
