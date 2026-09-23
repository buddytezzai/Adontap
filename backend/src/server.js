const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), override: true });
const app = require("./app");
const { cleanupExpiredAssets } = require("./routes/operationsRoutes");

const port = Number(process.env.PORT) || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));

const cleanupInterval = Number(process.env.CLEANUP_INTERVAL_MS || 60 * 60 * 1000);
setInterval(() => cleanupExpiredAssets().catch((error) => console.error("Scheduled cleanup failed", error)), cleanupInterval).unref();
