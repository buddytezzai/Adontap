const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const templateRoutes = require("./routes/templateRoutes");
const generationRoutes = require("./routes/generationRoutes");
const assetsRoutes = require("./routes/assetsRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const { publicRouter: publicScoutedRoutes, adminRouter: adminScoutedRoutes } = require("./routes/scoutedRoutes");
const { admin: operationsRoutes, cleanup: cleanupRoutes, payments: paymentRoutes } = require("./routes/operationsRoutes");

const app = express();

app.use(helmet());
// Comma-separated list of allowed browser origins, e.g. CORS_ORIGIN=http://localhost:3000
// (unset = same-origin only; the old cors() default allowed every site).
const allowed = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.length ? allowed : false }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/generate", generationRoutes);
app.use("/api/my-ads", assetsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/scouted-ads", publicScoutedRoutes);
app.use("/api/admin/scouted-ads", adminScoutedRoutes);
app.use("/api/admin", operationsRoutes);
app.use("/api/cron/cleanup", cleanupRoutes);
app.use("/api/payments", paymentRoutes);

app.use((error, _req, res, _next) => {
	console.error(error);
	if (error?.code === 7 || error?.details?.includes("firestore.googleapis.com")) {
		return res.status(503).json({
			message: "Firestore is not enabled for this Firebase project. Enable it in Firebase Console, then restart the backend.",
		});
	}
	res.status(error?.status || 500).json({ message: error?.status ? error.message : "Internal server error" });
});

module.exports = app;
