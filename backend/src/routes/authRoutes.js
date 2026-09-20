const express = require("express");
const verifyToken = require("../authMiddleware");

const router = express.Router();

// Returns the verified Firebase identity behind the Bearer token.
router.get("/me", verifyToken, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email ?? null });
});

module.exports = router;
