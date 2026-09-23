const express = require("express");
const crypto = require("node:crypto");
const verifyToken = require("../authMiddleware");
const { getBucket, getDb } = require("../firebase");

const router = express.Router();
router.use(verifyToken);
const MAX_BYTES = 8 * 1024 * 1024;
const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["video/mp4", "mp4"]]);

router.post("/", async (req, res, next) => {
  try {
    const { data, contentType } = req.body || {};
    if (typeof data !== "string" || !allowed.has(contentType)) return res.status(400).json({ message: "Provide base64 data and a supported content type" });
    const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!buffer.length || buffer.length > MAX_BYTES) return res.status(413).json({ message: "Upload must be between 1 byte and 8 MB" });
    const name = `users/${req.user.uid}/${crypto.randomUUID()}.${allowed.get(contentType)}`;
    const file = getBucket().file(name);
    await file.save(buffer, { resumable: false, metadata: { contentType, metadata: { ownerId: req.user.uid } } });
    const assetId = `upload-${crypto.randomUUID()}`;
    const storageUrl = `/api/uploads/${encodeURIComponent(name)}`;
    await getDb().collection("assets").doc(assetId).set({ id: assetId, userId: req.user.uid, type: "upload", storageUrl, storagePath: name, contentType, size: buffer.length, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() });
    res.status(201).json({ asset: { id: assetId, storageUrl, contentType, size: buffer.length } });
  } catch (error) { next(error); }
});

router.get("/:name", async (req, res, next) => {
  try {
    const name = req.params.name;
    const snapshot = await getDb().collection("assets").where("storagePath", "==", name).where("userId", "==", req.user.uid).limit(1).get();
    if (snapshot.empty) return res.status(404).end();
    const [contents] = await getBucket().file(name).download();
    res.set("Cache-Control", "private, no-store").type(snapshot.docs[0].data().contentType || "application/octet-stream").send(contents);
  } catch (error) { next(error); }
});

module.exports = router;