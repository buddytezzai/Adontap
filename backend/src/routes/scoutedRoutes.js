const express = require("express");
const crypto = require("node:crypto");
const verifyToken = require("../authMiddleware");
const requireAdmin = require("../adminMiddleware");
const { getDb } = require("../firebase");

const publicRouter = express.Router();
publicRouter.get("/", async (req, res, next) => {
  try {
    const snapshot = await getDb().collection("scoutedAds").where("approvedForPublic", "==", true).get();
    const ads = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ ads });
  } catch (error) { next(error); }
});
publicRouter.post("/:id/vote", verifyToken, async (req, res, next) => {
  try {
    const adRef = getDb().collection("scoutedAds").doc(req.params.id);
    const voteRef = adRef.collection("votes").doc(req.user.uid);
    const result = await getDb().runTransaction(async (transaction) => {
      const [ad, vote] = await Promise.all([transaction.get(adRef), transaction.get(voteRef)]);
      if (!ad.exists || !ad.data().approvedForPublic) throw Object.assign(new Error("Ad not found"), { code: "NOT_FOUND" });
      const count = Number(ad.data().voteCount || 0);
      if (vote.exists) { transaction.delete(voteRef); transaction.update(adRef, { voteCount: Math.max(0, count - 1) }); return { voted: false, count: Math.max(0, count - 1) }; }
      transaction.set(voteRef, { userId: req.user.uid, createdAt: new Date().toISOString() }); transaction.update(adRef, { voteCount: count + 1 }); return { voted: true, count: count + 1 };
    });
    res.json(result);
  } catch (error) { next(error.code === "NOT_FOUND" ? Object.assign(error, { status: 404 }) : error); }
});

const adminRouter = express.Router();
adminRouter.use(verifyToken, requireAdmin);
adminRouter.get("/", async (_req, res, next) => { try { const s = await getDb().collection("scoutedAds").get(); res.json({ ads: s.docs.map((d) => ({ id: d.id, ...d.data() })) }); } catch (e) { next(e); } });
adminRouter.post("/sync", async (_req, res, next) => { try { const id = `scout-${crypto.randomUUID()}`; const data = { advertiserName: "Demo intelligence feed", headline: "Sample creative pattern for review", creativeSnapshotUrl: "/samples/feature.jpg", category: "App / SaaS", platforms: ["Facebook", "Instagram"], deliveryStartDate: new Date().toISOString(), stillRunning: true, approvedForPublic: false, voteCount: 0, createdAt: new Date().toISOString() }; await getDb().collection("scoutedAds").doc(id).set(data); res.json({ totalSynced: 1, ads: [{ id, ...data }] }); } catch (e) { next(e); } });
adminRouter.patch("/:id", async (req, res, next) => { try { const ref = getDb().collection("scoutedAds").doc(req.params.id); await ref.set({ approvedForPublic: Boolean(req.body.approvedForPublic) }, { merge: true }); const d = await ref.get(); res.json({ ad: { id: d.id, ...d.data() } }); } catch (e) { next(e); } });

module.exports = { publicRouter, adminRouter };