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



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
