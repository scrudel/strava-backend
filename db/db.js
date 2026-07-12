import Database from "better-sqlite3";

export const db = new Database("data.sqlite");

export async function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS strava_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      athlete_id INTEGER UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scope TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY,           -- id aktywności ze Stravy
      athlete_id INTEGER NOT NULL,
      name TEXT,
      type TEXT,
      start_date TEXT,
      moving_time INTEGER,
      distance REAL,
      average_heartrate REAL,
      max_heartrate REAL,
      total_elevation_gain REAL,
      average_watts REAL,
      suffer_score REAL,               -- proxy obciążenia (Relative Effort ze Stravy)
      raw_json TEXT,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Baza danych gotowa (data.sqlite)");
}

export function saveTokens(athleteId, tokens) {
  const stmt = db.prepare(`
    INSERT INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at, scope)
    VALUES (@athlete_id, @access_token, @refresh_token, @expires_at, @scope)
    ON CONFLICT(athlete_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      scope = excluded.scope
  `);
  stmt.run({
    athlete_id: athleteId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    scope: tokens.scope || "",
  });
}

export function getTokens(athleteId) {
  return db.prepare("SELECT * FROM strava_tokens WHERE athlete_id = ?").get(athleteId);
}

export function getLatestAthlete() {
  // uproszczenie: jednoosobowa aplikacja — bierzemy jedynego/ostatniego sportowca
  return db.prepare("SELECT * FROM strava_tokens ORDER BY id DESC LIMIT 1").get();
}

export function upsertActivity(athleteId, a) {
  const stmt = db.prepare(`
    INSERT INTO activities (id, athlete_id, name, type, start_date, moving_time, distance,
      average_heartrate, max_heartrate, total_elevation_gain, average_watts, suffer_score, raw_json)
    VALUES (@id, @athlete_id, @name, @type, @start_date, @moving_time, @distance,
      @average_heartrate, @max_heartrate, @total_elevation_gain, @average_watts, @suffer_score, @raw_json)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, type=excluded.type, start_date=excluded.start_date,
      moving_time=excluded.moving_time, distance=excluded.distance,
      average_heartrate=excluded.average_heartrate, max_heartrate=excluded.max_heartrate,
      total_elevation_gain=excluded.total_elevation_gain, average_watts=excluded.average_watts,
      suffer_score=excluded.suffer_score, raw_json=excluded.raw_json, synced_at=CURRENT_TIMESTAMP
  `);
  stmt.run({
    id: a.id,
    athlete_id: athleteId,
    name: a.name,
    type: a.type,
    start_date: a.start_date,
    moving_time: a.moving_time,
    distance: a.distance,
    average_heartrate: a.average_heartrate || null,
    max_heartrate: a.max_heartrate || null,
    total_elevation_gain: a.total_elevation_gain || null,
    average_watts: a.average_watts || null,
    suffer_score: a.suffer_score || null,
    raw_json: JSON.stringify(a),
  });
}

export function listActivities(athleteId, limit = 200) {
  return db.prepare("SELECT * FROM activities WHERE athlete_id = ? ORDER BY start_date DESC LIMIT ?").all(athleteId, limit);
}
