const express = require("express");
const crypto = require("node:crypto");
const verifyToken = require("../authMiddleware");
const requireAdmin = require("../adminMiddleware");
const { getDb } = require("../firebase");

const admin = express.Router();
admin.use(verifyToken, requireAdmin);
admin.get("/orders", async (_req, res, next) => { try { const s = await getDb().collection("generations").get(); res.json({ orders: s.docs.map((d) => ({ id: d.id, ...d.data() })) }); } catch (e) { next(e); } });
admin.get("/wallets", async (_req, res, next) => { try { const s = await getDb().collection("users").get(); res.json({ wallets: s.docs.map((d) => ({ id: d.id, ...d.data() })) }); } catch (e) { next(e); } });
admin.post("/wallets/:id/adjust", async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const reason = String(req.body.reason || "Admin adjustment").slice(0, 300);
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) return res.status(400).json({ message: "Amount must be a non-zero whole number within limits" });
    const userRef = getDb().collection("users").doc(req.params.id);
    const adjustmentId = `adjust-${crypto.randomUUID()}`;
    await getDb().runTransaction(async (tx) => {
      const user = await tx.get(userRef); const balance = Number(user.data()?.creditBalance || 0); if (balance + amount < 0) throw Object.assign(new Error("Balance cannot become negative"), { code: "NEGATIVE" });
      tx.set(userRef, { creditBalance: balance + amount, updatedAt: new Date().toISOString() }, { merge: true });
      tx.set(userRef.collection("creditAdjustments").doc(adjustmentId), { amount, reason, adminId: req.user.uid, createdAt: new Date().toISOString() });
    });
    res.json({ id: adjustmentId, userId: req.params.id, amount, reason });
  } catch (e) { next(e.code === "NEGATIVE" ? Object.assign(e, { status: 400 }) : e); }
});
admin.get("/provider-status", (_req, res) => res.json({ higgsfield: Boolean(process.env.HIGGSFIELD_API_KEY), firebase: true, firestore: true, storage: Boolean(process.env.FIREBASE_STORAGE_BUCKET), payments: Boolean(process.env.PAYMENT_WEBHOOK_SECRET), cleanup: true }));

async function cleanupExpiredAssets() {
    const snapshot = await getDb().collection("assets").where("expiresAt", "<=", new Date().toISOString()).get(); let count = 0;
    const { getBucket } = require("../firebase");
    for (const doc of snapshot.docs) { const data = doc.data(); if (data.storagePath) await getBucket().file(data.storagePath).delete({ ignoreNotFound: true }); await getDb().collection("assets").doc(doc.id).delete(); count++; }
    return count;
}
const cleanup = express.Router();
cleanup.post("/", async (req, res, next) => {
  try {
    if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ message: "Unauthorized" });
    res.json({ cleanedCount: await cleanupExpiredAssets() });
  } catch (e) { next(e); }
});

const payments = express.Router();
payments.post("/webhook", async (req, res, next) => {
  try {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET; const signature = req.headers["x-payment-signature"];
    if (!secret || !signature) return res.status(503).json({ message: "Payment webhook is not configured" });
    const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");
    const provided = Buffer.from(String(signature)); const expectedBuffer = Buffer.from(expected);
    if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) return res.status(401).json({ message: "Invalid signature" });
    const { eventId, userId, credits } = req.body; if (!eventId || !userId || !Number.isInteger(credits) || credits <= 0) return res.status(400).json({ message: "Invalid payment event" });
    const eventRef = getDb().collection("paymentEvents").doc(String(eventId)); const userRef = getDb().collection("users").doc(userId);
    await getDb().runTransaction(async (tx) => { const event = await tx.get(eventRef); if (event.exists) return; const user = await tx.get(userRef); tx.set(userRef, { creditBalance: Number(user.data()?.creditBalance || 0) + credits, updatedAt: new Date().toISOString() }, { merge: true }); tx.set(eventRef, { userId, credits, createdAt: new Date().toISOString() }); });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
module.exports = { admin, cleanup, payments, cleanupExpiredAssets };
