const express = require("express");
const crypto = require("node:crypto");
const verifyToken = require("../authMiddleware");
const { getDb } = require("../firebase");
const { resolveValues, assemblePrompt } = require("../generation");
const { generateVideo } = require("../higgsfield");

const router = express.Router();
router.use(verifyToken);

router.post("/", async (req, res, next) => {
  try {
    const templateId = String(req.body?.templateId || "");
    if (!templateId || typeof req.body?.values !== "object") return res.status(400).json({ message: "templateId and values are required" });
    const templateRef = getDb().collection("templates").doc(templateId);
    const userRef = getDb().collection("users").doc(req.user.uid);
    const [templateDoc, userDoc] = await Promise.all([templateRef.get(), userRef.get()]);
    if (!templateDoc.exists || templateDoc.data().status !== "published") return res.status(404).json({ message: "Template not found" });
    const template = templateDoc.data();
    const values = resolveValues(template.variables, req.body.values);
    const assembledPrompt = assemblePrompt(template.basePrompt, values, req.body.prompt);
    const totalInr = Math.round(Number(template.priceInr || 0) * (1 + Number(template.gstRate || 0)));
    const user = userDoc.exists ? userDoc.data() : { creditBalance: 0 };
    const balance = Number(user.creditBalance || 0);
    if (balance < totalInr) return res.status(402).json({ message: `Insufficient credits. This render costs ₹${totalInr}.` });

    const generationId = `gen-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const assetId = `asset-${crypto.randomUUID()}`;
    let providerVideo = null;
    let providerRequestId = null;
    if ((template.engine === "Higgsfield" || template.engine === "Seedance") && process.env.HIGGSFIELD_API_KEY) {
      const rendered = await generateVideo(assembledPrompt, template.durationSeconds);
      providerVideo = rendered.videoUrl;
      providerRequestId = rendered.requestId;
    }
    await getDb().runTransaction(async (transaction) => {
      const freshUser = await transaction.get(userRef);
      const freshBalance = Number(freshUser.data()?.creditBalance || 0);
      if (freshBalance < totalInr) throw Object.assign(new Error("Insufficient credits"), { code: "INSUFFICIENT_CREDITS" });
      transaction.set(userRef, { creditBalance: freshBalance - totalInr, updatedAt: new Date().toISOString() }, { merge: true });
      transaction.set(getDb().collection("generations").doc(generationId), {
        userId: req.user.uid, templateId, templateTitle: template.title, submittedValues: req.body.values,
        assembledPrompt, totalInr, status: "complete", createdAt: new Date().toISOString(),
      });
      transaction.set(getDb().collection("assets").doc(assetId), {
        userId: req.user.uid, templateId, templateTitle: template.title, type: "generated",
        storageUrl: providerVideo || template.image || "/samples/unbox.jpg", expiresAt, createdAt: new Date().toISOString(),
        metadata: { generationId, engine: template.engine, durationSeconds: template.durationSeconds, pricePaid: totalInr, providerRequestId },
      });
    }).catch((error) => {
      if (error.code === "INSUFFICIENT_CREDITS") return res.status(402).json({ message: `Insufficient credits. This render costs ₹${totalInr}.` });
      throw error;
    });
    if (res.headersSent) return;
    res.json({ generationId, status: "complete", title: template.title, durationSeconds: template.durationSeconds, engine: template.engine, priceInr: template.priceInr, totalInr, chargedInr: totalInr, assetUrl: providerVideo || template.image || "/samples/unbox.jpg", videoReady: Boolean(providerVideo), videoUrl: providerVideo || undefined, expiresAt });
  } catch (error) { next(error); }
});

module.exports = router;