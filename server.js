import "dotenv/config";
import express from "express";
import cors from "cors";
import { db, initDb } from "./db/db.js";
import authRoutes from "./routes/auth.js";
import activityRoutes from "./routes/activities.js";
import webhookRoutes from "./routes/webhook.js";

const app = express();
app.use(cors());
app.use(express.json());

await initDb();

app.use("/auth/strava", authRoutes);
app.use("/api/activities", activityRoutes);
app.use("/webhook/strava", webhookRoutes);

app.get("/", (req, res) => {
  res.send("Trener Hybrydowy — backend Strava działa.");
});

// TYMCZASOWY endpoint diagnostyczny — pokazuje TYLKO czy zmienne środowiskowe
// dotarły do serwera, nigdy ich pełnej wartości. Usuniemy go, gdy wszystko
// zadziała.
app.get("/debug/env", (req, res) => {
  const id = process.env.STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET;
  const redirect = process.env.STRAVA_REDIRECT_URI;
  res.json({
    STRAVA_CLIENT_ID_present: !!id,
    STRAVA_CLIENT_ID_preview: id ? String(id).slice(0, 3) + "..." : null,
    STRAVA_CLIENT_SECRET_present: !!secret,
    STRAVA_REDIRECT_URI_present: !!redirect,
    STRAVA_REDIRECT_URI_value: redirect || null,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
