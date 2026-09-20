const { getAdmin, isConfigured } = require("./firebase");

const verifyToken = async (req, res, next) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: "Authentication is not configured on this server" });
  }

  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    req.user = await getAdmin().auth().verifyIdToken(token);
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = verifyToken;
