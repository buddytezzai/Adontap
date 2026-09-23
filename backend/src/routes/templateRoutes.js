const express = require("express");
const { getDb } = require("../firebase");
const { publicTemplate } = require("../templateValidation");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    const snapshot = await getDb().collection("templates").where("status", "==", "published").get();
    const templates = snapshot.docs.map((doc) => publicTemplate(doc.id, doc.data()));
    templates.sort((left, right) => left.title.localeCompare(right.title));
    res.json({ templates });
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const doc = await getDb().collection("templates").doc(req.params.id).get();
    if (!doc.exists || doc.data().status !== "published") return res.status(404).json({ message: "Template not found" });
    res.json({ template: publicTemplate(doc.id, doc.data()) });
  } catch (error) { next(error); }
});

module.exports = router;