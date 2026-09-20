const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(helmet());
// Comma-separated list of allowed browser origins, e.g. CORS_ORIGIN=http://localhost:3000
// (unset = same-origin only; the old cors() default allowed every site).
const allowed = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.length ? allowed : false }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);

module.exports = app;
