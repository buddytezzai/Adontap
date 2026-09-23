const express = require("express");
const verifyToken = require("../authMiddleware");
const { getDb } = require("../firebase");

const router = express.Router();
router.use(verifyToken);

function toRepositoryAsset(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    templateId: data.templateId,
    title: data.templateTitle,
    cat: data.category || "Generated video ad",
    image: data.storageUrl,
    storageUrl: data.storageUrl,
    dur: `${data.metadata?.durationSeconds || 0}s`,
    price: data.metadata?.pricePaid || 0,
    engine: data.metadata?.engine || "AI",
    createdAt: data.createdAt,
    expiresAt: new Date(data.expiresAt).getTime(),
    isWatermarked: true,
    type: data.type || "generated",
  };
}

router.get("/", async (req, res, next) => {
  try {
    const snapshot = await getDb().collection("assets").where("userId", "==", req.user.uid).get();
    const now = Date.now();
    const assets = snapshot.docs
      .filter((doc) => new Date(doc.data().expiresAt).getTime() > now)
      .map(toRepositoryAsset)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    res.json({ assets });
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const ref = getDb().collection("assets").doc(req.params.id);
    const asset = await ref.get();
    if (!asset.exists || asset.data().userId !== req.user.uid) return res.status(404).json({ message: "Asset not found" });
    await ref.delete();
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
