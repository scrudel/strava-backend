import express from "express";

const router = express.Router();

/**
 * Strava weryfikuje webhook zapytaniem GET z hub.challenge — trzeba je odesłać.
 * Wymaga jednorazowej rejestracji subskrypcji (patrz README, krok 5 — opcjonalny).
 */
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return res.json({ "hub.challenge": challenge });
  }
  res.status(403).send("Weryfikacja webhooka nie powiodła się");
});

/**
 * Strava wysyła tu event za każdym razem, gdy pojawi się nowa aktywność.
 * Tu tylko logujemy — docelowo: wywołać POST /api/activities/sync
 * i przeliczenie planu (patrz README, krok 6).
 */
router.post("/", (req, res) => {
  console.log("Strava webhook event:", JSON.stringify(req.body));
  // TODO: gdy object_type === "activity" && aspect_type === "create",
  // wywołaj wewnętrznie sync + przeliczenie planu (np. przez event/queue).
  res.status(200).send("EVENT_RECEIVED"); // Strava wymaga odpowiedzi 200 w ciągu 2s
});

export default router;
