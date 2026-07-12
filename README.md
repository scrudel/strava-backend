# Trener Hybrydowy — backend Strava (OAuth, tylko odczyt)

Ten serwer robi dokładnie trzy rzeczy:
1. Przeprowadza Cię przez oficjalne logowanie na stronie Stravy (nigdy nie widzi Twojego hasła).
2. Przechowuje token dostępowy **tylko do odczytu** (`read,activity:read_all,profile:read_all` —
   brak jakiegokolwiek scope zapisu).
3. Pobiera Twoje aktywności i udostępnia je w formacie gotowym dla silnika CTL/ATL/TSB
   z aplikacji "Trener Hybrydowy".

## Krok 1 — zależności

```bash
npm install
```

## Krok 2 — dane z panelu deweloperskiego Stravy

1. Wejdź na https://www.strava.com/settings/api i utwórz aplikację (jeśli jeszcze nie masz).
2. Skopiuj plik `.env.example` do `.env`:
   ```bash
   cp .env.example .env
   ```
3. Wklej do `.env` swoje `Client ID` i `Client Secret` ze strony Stravy.
4. Na razie zostaw `STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback`.

## Krok 3 — uruchomienie lokalne

```bash
npm run dev
```

Serwer wystartuje na `http://localhost:3000`.

## Krok 4 — połączenie konta

1. Otwórz w przeglądarce: **http://localhost:3000/auth/strava/login**
2. Zostaniesz przekierowany na **prawdziwą stronę Stravy** — tam się logujesz i klikasz "Autoryzuj".
3. Strava przekieruje Cię z powrotem i zobaczysz "Połączono ze Stravą ✓".
4. Token trafia do lokalnego pliku `data.sqlite` (SQLite) — nic nie wysyłamy nigdzie indziej.

## Krok 5 — pobranie danych

```bash
curl -X POST http://localhost:3000/api/activities/sync
curl http://localhost:3000/api/activities
```

Drugie zapytanie zwraca aktywności w formacie:
```json
[{ "id": "...", "date": "2026-07-10", "discipline": "MTB", "durationMin": 95, "tss": 78, ... }]
```
Dokładnie takim, jakiego oczekuje silnik CTL/ATL/TSB w aplikacji "Trener Hybrydowy" — można go
podłączyć zamiast danych demo (`generateMockActivities`) przez zwykłe `fetch("http://localhost:3000/api/activities")`.

## Krok 6 (opcjonalny, później) — webhook do auto-przeliczania planu po treningu

Gdy backend będzie już wystawiony publicznie (patrz niżej), można zarejestrować webhook Stravy,
żeby serwer dowiadywał się o nowym treningu w czasie rzeczywistym zamiast czekać na ręczny `sync`:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=TWOJ_CLIENT_ID \
  -F client_secret=TWOJ_CLIENT_SECRET \
  -F callback_url=https://twoja-domena.pl/webhook/strava \
  -F verify_token=TAKI_SAM_JAK_W_.ENV
```

## Krok 7 — wystawienie publicznie (żeby aplikacja frontendowa mogła się z nim łączyć)

Najprostsza opcja bez własnego serwera: **Railway** lub **Render** (darmowy/tani tier):
1. Wrzuć ten folder na GitHub.
2. W Railway/Render: "New Project" → połącz repozytorium → dodaj zmienne z `.env` w panelu.
3. Po deployu dostaniesz publiczny URL, np. `https://trener-strava.up.railway.app`.
4. Zaktualizuj w Strava API Settings **Authorization Callback Domain** na tę domenę
   oraz `STRAVA_REDIRECT_URI` w zmiennych środowiskowych na
   `https://trener-strava.up.railway.app/auth/strava/callback`.

## Bezpieczeństwo i zakres uprawnień

- Scope OAuth zawiera wyłącznie prawa odczytu — nie ma technicznej możliwości, żeby ten kod
  cokolwiek zmienił lub usunął na Twoim koncie Stravy.
- Token dostępowy wygasa po ok. 6h i jest automatycznie odświeżany (`refreshAccessToken`
  w `routes/auth.js`) — nie musisz się ponownie logować.
- `client_secret` trzyma się wyłącznie w `.env` na serwerze — nigdy nie trafia do przeglądarki
  ani do frontendu aplikacji.

## Co dalej

Gdy to zadziała, zrobimy dokładnie ten sam schemat dla **Garmin Connect** (Garmin ma osobny,
bardziej ograniczony proces zatwierdzania dewelopera — zajmie trochę dłużej niż Strava, więc
lepiej złożyć wniosek już teraz równolegle). Daj znać, jak Ci poszło połączenie ze Stravą.
