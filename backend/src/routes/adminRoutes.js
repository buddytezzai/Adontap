const express = require("express");
const verifyToken = require("../authMiddleware");
const requireAdmin = require("../adminMiddleware");
const { getDb } = require("../firebase");
const { templateInput } = require("../templateValidation");

const router = express.Router();
router.use(verifyToken, requireAdmin);

const clean = (id, data) => ({ id, ...data });

router.get("/me", (req, res) => res.json({ user: { uid: req.user.uid, email: req.user.email || "" } }));

router.get("/overview", async (_req, res, next) => {
  try {
    const db = getDb();
    const [templates, generations, users, assets] = await Promise.all([
      db.collection("templates").get(), db.collection("generations").get(),
      db.collection("users").get(), db.collection("assets").get(),
    ]);
    const revenueInr = generations.docs.reduce((sum, doc) => sum + Number(doc.data().totalInr || 0), 0);
    res.json({
      templates: { total: templates.size, published: templates.docs.filter((doc) => doc.data().status === "published").length },
      generations: { total: generations.size, revenueInr },
      users: users.size,
      activeAssets: assets.docs.filter((doc) => new Date(doc.data().expiresAt).getTime() > Date.now()).length,
    });
  } catch (error) { next(error); }
});

router.get("/templates", async (_req, res, next) => {
  try {
    const snapshot = await getDb().collection("templates").get();
    snapshot.docs.sort((left, right) => String(right.data().createdAt || "").localeCompare(String(left.data().createdAt || "")));
    res.json({ templates: snapshot.docs.map((doc) => clean(doc.id, doc.data())) });
  } catch (error) { next(error); }
});

router.post("/templates", async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const data = { ...templateInput(req.body), createdAt: now, updatedAt: now };
    const ref = await getDb().collection("templates").add(data);
    res.status(201).json({ template: clean(ref.id, data) });
  } catch (error) { next(error); }
});

router.patch("/templates/:id", async (req, res, next) => {
  try {
    const ref = getDb().collection("templates").doc(req.params.id);
    const data = { ...templateInput(req.body), updatedAt: new Date().toISOString() };
    await ref.set(data, { merge: true });
    const saved = await ref.get();
    res.json({ template: clean(saved.id, saved.data()) });
  } catch (error) { next(error); }
});

router.post("/templates/:id/duplicate", async (req, res, next) => {
  try {
    const source = await getDb().collection("templates").doc(req.params.id).get();
    if (!source.exists) return res.status(404).json({ message: "Template not found" });
    const sourceData = source.data();
    const now = new Date().toISOString();
    const data = { ...sourceData, title: `${sourceData.title} (Copy)`, status: "draft", createdAt: now, updatedAt: now };
    const ref = await getDb().collection("templates").add(data);
    res.status(201).json({ template: clean(ref.id, data) });
  } catch (error) { next(error); }
});

router.delete("/templates/:id", async (req, res, next) => {
  try { await getDb().collection("templates").doc(req.params.id).delete(); res.status(204).end(); }
  catch (error) { next(error); }
});

module.exports = router;