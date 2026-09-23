const { getDb } = require("./firebase");

async function requireAdmin(req, res, next) {
  try {
    const configuredEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const claim = req.user?.admin === true || (configuredEmail && req.user?.email?.toLowerCase() === configuredEmail);
    if (claim) return next();
    const record = await getDb().collection("admins").doc(req.user.uid).get();
    if (!claim && !record.exists) return res.status(403).json({ message: "Admin access required" });
    next();
  } catch (error) {
    console.error("Admin authorization failed", error);
    res.status(503).json({ message: "Admin authorization is unavailable" });
  }
}

module.exports = requireAdmin;