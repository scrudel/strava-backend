import express from "express";
import { saveTokens } from "../db/db.js";

const router = express.Router();

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

// UWAGA: zakres celowo ograniczony do odczytu — aplikacja nigdy nie prosi
// o uprawnienia zapisu (nie ma scope "activity:write" ani "profile:write").
const SCOPE = "read,activity:read_all,profile:read_all";

/**
 * Krok 1: przekierowanie użytkownika na oficjalny ekran logowania Stravy.
 * Użytkownik loguje się WYŁĄCZNIE na stronie Stravy — ta aplikacja nigdy
 * nie widzi jego hasła.
 */
router.get("/login", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: process.env.STRAVA_REDIRECT_URI, // np. http://localhost:3000/auth/strava/callback
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPE,
  });
  res.redirect(`${STRAVA_AUTH_URL}?${params.toString()}`);
});

/**
 * Krok 2: Strava przekierowuje tu z jednorazowym kodem `code`.
 * Wymieniamy go na access_token + refresh_token.
 */
router.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Autoryzacja odrzucona przez użytkownika: ${error}`);
  }
  if (!code) {
    return res.status(400).send("Brak kodu autoryzacyjnego w odpowiedzi Stravy.");
  }

  try {
    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Strava token exchange failed: ${text}`);
    }

    const data = await tokenRes.json();
    // data: { access_token, refresh_token, expires_at, athlete: {...}, scope }

    saveTokens(data.athlete.id, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      scope: data.scope,
    });

    res.send(`
      <h2>Połączono ze Stravą ✓</h2>
      <p>Witaj, ${data.athlete.firstname || "sportowcu"}. Konto (ID: ${data.athlete.id}) zostało połączone
      w trybie tylko do odczytu. Możesz zamknąć tę kartę i wrócić do aplikacji.</p>
    `);
  } catch (e) {
    console.error(e);
    res.status(500).send("Błąd podczas łączenia ze Stravą. Sprawdź logi serwera.");
  }
});

/**
 * Odświeżenie access_token przy użyciu refresh_token (tokeny Stravy wygasają po 6h).
 */
export async function refreshAccessToken(tokenRow) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Nie udało się odświeżyć tokenu Stravy");
  const data = await res.json();
  saveTokens(tokenRow.athlete_id, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    scope: tokenRow.scope,
  });
  return data.access_token;
}

export default router;
