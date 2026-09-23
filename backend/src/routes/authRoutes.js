const express = require("express");
const verifyToken = require("../authMiddleware");
const { getDb } = require("../firebase");

const router = express.Router();

// Returns the verified Firebase identity behind the Bearer token.
router.get("/me", verifyToken, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email ?? null });
});

router.get("/profile", verifyToken, async (req, res, next) => {
  try {
    const ref = getDb().collection("users").doc(req.user.uid);
    const existing = await ref.get();
    if (!existing.exists) {
      const profile = {
        uid: req.user.uid,
        email: req.user.email || "",
        displayName: req.user.name || req.user.email?.split("@")[0] || "Customer",
        creditBalance: Number(process.env.SIGNUP_BONUS_CREDITS || 1200),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await ref.set(profile);
      return res.json({ user: profile });
    }
    res.json({ user: existing.data() });
  } catch (error) { next(error); }
});

module.exports = router;
