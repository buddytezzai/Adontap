// End-to-end acceptance walkthrough, driven through a real Chrome (playwright-core + system Chrome).
// Runs against a production build (`npm run build && npm start`) — nothing is rebuilt between steps.
//
//   BASE_URL=http://localhost:3100 ADMIN_EMAIL=... ADMIN_PASSWORD=... node verification/walkthrough.mjs
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve("verification/output");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const NAME = "Walkthrough Template";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const steps = []; // { id, title, checks:[{label, pass, detail}], shots:[file] }
let cur;
const step = (id, title) => steps.push((cur = { id, title, checks: [], shots: [] }));
const check = (label, pass, detail = "") => {
  cur.checks.push({ label, pass: !!pass, detail: String(detail) });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
};
let shotN = 0;
async function shot(page, name, opts = {}) {
  const file = `${String(++shotN).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), ...opts });
  cur.shots.push(file);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
ctx.on("dialog", (d) => d.accept()); // the delete confirm()

// A second browser context with NO session, standing in for "a customer".
const cust = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const publicPage = await cust.newPage();
const publicResponses = []; // every /api/templates* response body the customer's browser received
publicPage.on("response", async (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith("/api/templates")) publicResponses.push({ url: u.pathname, status: r.status(), body: await r.text().catch(() => "") });
});
const galleryCards = async (p) => {
  await p.waitForSelector(".tmpl-card, .gallery-note", { timeout: 15000 });
  return p.locator(".tmpl-card").allInnerTexts();
};
// Waits for a toast that contains `needle` — never returns on a stale toast from an earlier action.
const waitToast = async (p, needle) => {
  await p.waitForFunction((n) => { const t = document.querySelector(".toast"); return t?.classList.contains("show") && t.textContent.includes(n); }, needle, { timeout: 10000 });
  return (await p.locator(".toast").textContent()).trim();
};
// CSS uppercases many labels and innerText() returns the *rendered* text, so read textContent.
const text = async (loc) => ((await loc.textContent()) ?? "").replace(/\s+/g, " ").trim();
const pillOf = (p, id) => text(p.locator(`#templateTbody tr[data-id="${id}"] .status-pill`));

const admin = await ctx.newPage();
let scoutedBefore;

try {
  // ───────────── 0. baseline
  step("baseline", "Baseline: public gallery before any change");
  await publicPage.goto(BASE + "/");
  const before = await galleryCards(publicPage);
  const beforeCount = before.length;
  check("Public gallery renders published templates from the API", beforeCount > 0, `${beforeCount} cards`);
  check(`"${NAME}" is not in the gallery yet`, !before.some((t) => t.includes(NAME)));
  await shot(publicPage, "public-gallery-before", { fullPage: false });

  // ───────────── auth gate
  step("auth", "/admin is not open to the public");
  const anon = await cust.newPage();
  await anon.goto(BASE + "/admin");
  check("Unauthenticated /admin redirects to the login page", new URL(anon.url()).pathname === "/admin/login", anon.url());
  const anonApi = await anon.evaluate(async () => (await fetch("/api/admin/templates")).status);
  check("Unauthenticated GET /api/admin/templates → 401", anonApi === 401, anonApi);
  await shot(anon, "admin-login");
  await anon.close();
  await admin.goto(BASE + "/admin");
  await admin.fill("#email", process.env.ADMIN_EMAIL);
  await admin.fill("#password", process.env.ADMIN_PASSWORD);
  await admin.click("button[type=submit]");
  await admin.waitForURL(BASE + "/admin");
  await admin.waitForSelector("#templateTbody tr");
  check("Signing in with the seeded admin lands on the template library", (await admin.locator("#templateTbody tr").count()) >= 8);
  await shot(admin, "admin-template-library");

  // ───────────── 1. create + publish
  step("create-publish", "1 · Create a template in /admin, mark 2 variables editable, publish");
  await admin.click("#addTemplateBtn");
  await admin.waitForSelector(".drawer.open");
  await admin.fill("#f_title", NAME);
  await admin.fill("#f_cat", "QA · Walkthrough");
  await admin.fill("#f_dur", "12");
  await admin.fill("#f_cost", "90");
  await admin.fill("#f_price", "200");
  await admin.selectOption("#f_engine", "GoogleVeo");
  await admin.click('#iconPicker button[data-icon="🎬"]');
  await admin.fill("#f_baseprompt", "A {{avatarGender}} in a {{environment}}, camera does a {{camera}}, pacing {{pacing}}, look {{style}}. They say: {{script}}");
  // default variables ship with `script` editable; also make `camera` editable → exactly 2 editable
  await admin.locator('.var-row[data-key="camera"] input[data-f="editable"]').check();
  const econ = (await admin.locator("#econOut").innerText()).replace(/\s+/g, " ");
  check("Unit-economics calculator: 200 price / 90 cost", /Margin\s*55%/.test(econ) && /₹110/.test(econ) && /₹36/.test(econ) && /₹236/.test(econ), econ);
  const preview = await admin.locator("#previewBubble").innerText();
  check("Live assembled prompt resolves every {{token}}", !preview.includes("{{") && preview.includes("Slow push-in"), preview.slice(0, 90) + "…");
  const simLabels = await admin.locator("#simPanel .sim-col:nth-child(2) .sim-row .k").allTextContents();
  check("Studio-simulation shows exactly 2 editable fields (Script, Camera movement)", simLabels.join("|") === "Script|Camera movement", simLabels.join(" + "));
  await admin.locator(".drawer-body").evaluate((el) => (el.scrollTop = 0));
  await shot(admin, "admin-editor-drawer");
  await admin.locator(".drawer-body").evaluate((el) => (el.scrollTop = 900));
  await shot(admin, "admin-editor-drawer-preview");
  await admin.click("#publishBtn");
  check("Toast confirms it is live", (await waitToast(admin, "is now live")).includes(NAME), "");
  const row = admin.locator("#templateTbody tr", { hasText: NAME });
  const tid = await row.getAttribute("data-id");
  check("New row appears in the library with a Published pill", (await pillOf(admin, tid)) === "published", `id ${tid}`);
  const persisted = await db.query('select status, "costInr", "priceInr", engine, icon, "durationSeconds" from "Template" where id=$1', [tid]);
  check("Row exists in Postgres with the values entered", persisted.rows[0]?.costInr === 90 && persisted.rows[0]?.priceInr === 200 && persisted.rows[0]?.engine === "GoogleVeo" && persisted.rows[0]?.icon === "🎬", JSON.stringify(persisted.rows[0]));
  const ed = await db.query('select key, editable from "TemplateVariable" where "templateId"=$1 order by "sortOrder"', [tid]);
  check("Exactly 2 variables are flagged editable in Postgres", ed.rows.filter((r) => r.editable).map((r) => r.key).sort().join() === "camera,script", ed.rows.filter((r) => r.editable).map((r) => r.key).join());
  await shot(admin, "admin-after-publish");

  // ───────────── 1b. shows up publicly with no rebuild
  step("public-appears", "1 · Public site shows it — same running server, no rebuild/redeploy");
  await publicPage.reload();
  const after = await galleryCards(publicPage);
  const card = publicPage.locator(".tmpl-card", { hasText: NAME });
  check("New card appears in the public gallery after a plain refresh", (await card.count()) === 1, `${after.length} cards (was ${beforeCount})`);
  const cardText = await text(card);
  check("Card shows price, duration, category, icon", ["₹200 / video", "12s", "QA · Walkthrough", "🎬"].every((x) => cardText.includes(x)), cardText);
  const heroCount = await publicPage.locator("#heroCount").innerText();
  check("Hero counter is live too", heroCount === String(after.length), heroCount);
  await card.click();
  await publicPage.waitForSelector("#lockTitle");
  await publicPage.waitForFunction((n) => document.getElementById("lockTitle")?.textContent === n, NAME);
  const editableLabels = await publicPage.locator("#editableFields .field label").allTextContents();
  const inputs = await publicPage.locator("#editableFields textarea, #editableFields select, #editableFields input").count();
  const lockedRows = await publicPage.locator("#lockRows .lock-row .k").allTextContents();
  check("Studio renders exactly 2 real inputs", inputs === 2 && editableLabels.join("|") === "Script|Camera movement", `${editableLabels.join(" + ")}`);
  check("Everything else is in the read-only locked panel", ["Avatar", "Environment", "Pacing", "Visual style", "Engine"].every((k) => lockedRows.includes(k)) && !lockedRows.includes("Camera movement") && !lockedRows.includes("Your script"), lockedRows.join(" · "));
  check("Locked panel lists engine with display name", (await text(publicPage.locator("#lockRows"))).includes("Google Veo · 12s render"));
  check("Lock chip counts them", (await text(publicPage.locator("#lockChip"))).includes("4 locked by AdMaya — 2 fields"), await text(publicPage.locator("#lockChip")));
  await publicPage.evaluate(() => document.getElementById("studio").scrollIntoView());
  await shot(publicPage, "public-studio-2-editable");

  // deep link for a published template
  const deep = await cust.newPage();
  const deepResp = await deep.goto(`${BASE}/studio/${tid}`);
  await deep.waitForFunction((n) => document.getElementById("lockTitle")?.textContent === n, NAME, { timeout: 15000 });
  check("Deep link /studio/:id opens the Studio with that template selected", deepResp.status() === 200 && (await deep.locator(".tmpl-card.selected").count()) === 1, `HTTP ${deepResp.status()}`);
  await deep.close();

  // ───────────── 3. network inspection
  step("no-leak", "3 · The public API never sends costInr or basePrompt (inspected in the browser)");
  const apiCalls = publicResponses.filter((r) => r.url.startsWith("/api/templates"));
  const listResp = apiCalls.filter((r) => r.url === "/api/templates").at(-1);
  const detailResp = apiCalls.filter((r) => r.url === `/api/templates/${tid}`).at(-1);
  check("Browser received GET /api/templates (200)", listResp?.status === 200 && listResp.body.length > 100, `${listResp?.body.length} bytes`);
  check("Browser received GET /api/templates/:id (200)", detailResp?.status === 200 && detailResp.body.length > 100, `${detailResp?.body.length} bytes`);
  const forbid = /costInr|basePrompt|"cost"|"prompt"|"status"|base_prompt|cost_inr/i;
  const scan = (b) => JSON.stringify(b).match(forbid);
  check("/api/templates body has no cost/basePrompt/status field", !forbid.test(listResp.body), "scanned " + listResp.body.length + " bytes");
  check("/api/templates/:id body has no cost/basePrompt/status field", !forbid.test(detailResp.body), "scanned " + detailResp.body.length + " bytes");
  check("Neither body contains the secret base-prompt text or cost values", !listResp.body.includes("They say:") && !listResp.body.includes("camera does a") && !detailResp.body.includes("They say:"));
  const allPublic = publicResponses.every((r) => !forbid.test(r.body));
  check("…and that holds for every /api/templates* response this browser received", allPublic, `${publicResponses.length} responses`);
  const raw = await publicPage.evaluate(async (id) => {
    const r = await fetch(`/api/templates/${id}`);
    return { status: r.status, cache: r.headers.get("cache-control"), text: await r.text() };
  }, tid);
  check("Direct fetch() from the customer's DevTools context: same result, cache-control: no-store", raw.status === 200 && raw.cache === "no-store" && !forbid.test(raw.text), `${raw.status} ${raw.cache}`);
  cur.evidence = { detailJson: JSON.stringify(JSON.parse(detailResp.body), null, 2) };
  // screenshot of the raw JSON as a browser shows it
  const jsonPage = await cust.newPage({ viewport: { width: 1100, height: 900 } });
  await jsonPage.goto(`${BASE}/api/templates/${tid}`);
  await shot(jsonPage, "public-api-detail-json");
  await jsonPage.close();

  // ───────────── 4. locked-variable tamper attempt
  step("tamper", "4 · Submitting a value for a locked variable is ignored server-side");
  // 4a. through the real UI: edit both editable fields, generate, and inspect what the browser sent
  await publicPage.fill("#field_script", "My tampered-with test script");
  await publicPage.selectOption("#field_camera", "Handheld follow");
  let sentBody;
  publicPage.on("request", (rq) => { if (rq.url().endsWith("/api/generate")) sentBody = rq.postDataJSON(); });
  await publicPage.click("#genBtn");
  await publicPage.waitForSelector("#payPanel.show");
  const payText = (await publicPage.locator("#payPanel").innerText()).replace(/\s+/g, " ");
  check("Pay panel shows price + GST + total (₹200 + 18% = ₹236)", /₹36/.test(payText) && /₹236/.test(payText), payText);
  await shot(publicPage, "public-pay-panel");
  await publicPage.click("#confirmPayBtn");
  await publicPage.waitForSelector("#genProgress.show");
  await shot(publicPage, "public-progress");
  await publicPage.waitForSelector("#genResult.show", { timeout: 20000 });
  check("Progress bar → watermarked result card, as in the prototype", (await text(publicPage.locator("#resultMeta"))).includes("12s · ₹236 paid · Google Veo"), await text(publicPage.locator("#resultMeta")));
  check("UI sent ONLY the editable keys {script, camera}", Object.keys(sentBody.values).sort().join() === "camera,script", JSON.stringify(sentBody));
  await publicPage.evaluate(() => document.getElementById("genResult").scrollIntoView({ block: "center" }));
  await shot(publicPage, "public-result");

  // 4b. a hand-crafted request, as someone with DevTools would send it
  const lockedDefault = (await db.query('select "defaultValue" from "TemplateVariable" where "templateId"=$1 and key=\'environment\'', [tid])).rows[0].defaultValue;
  const tampered = await publicPage.evaluate(async (id) => {
    const r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id, values: { script: "S-OK", camera: "Static lock-off", environment: "HACKED-ENVIRONMENT", pacing: "HACKED-PACING", avatarGender: "HACKED", basePrompt: "HACKED-PROMPT", __proto__: "x", unknownKey: "y" } }),
    });
    return { status: r.status, text: await r.text() };
  }, tid);
  check("Tampered request is accepted (not an error) …", tampered.status === 200, tampered.text.slice(0, 120));
  check("… and the response never contains the assembled prompt", !/HACKED|S-OK|They say|camera does/i.test(tampered.text));
  const gid = JSON.parse(tampered.text).generationId;
  const gen = (await db.query('select "assembledPrompt", "submittedValues" from "Generation" where id=$1', [gid])).rows[0];
  check("Stored prompt uses the LOCKED default for environment", gen.assembledPrompt.includes(lockedDefault) && !gen.assembledPrompt.includes("HACKED"), gen.assembledPrompt);
  check("Editable values were applied (script + camera)", gen.assembledPrompt.includes("S-OK") && gen.assembledPrompt.includes("Static lock-off"));
  cur.evidence = { lockedDefault, submitted: gen.submittedValues, assembledPrompt: gen.assembledPrompt };
  const badSelect = await publicPage.evaluate(async (id) => (await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: id, values: { camera: "Helicopter shot" } }) })).status, tid);
  check("An invalid choice for an EDITABLE dropdown is rejected (400)", badSelect === 400, badSelect);

  // ───────────── 5. edit a locked variable's default in /admin
  step("edit-locked", "5 · Change a locked variable (Environment) in /admin → public panel updates, no code change");
  await admin.reload();
  await admin.waitForSelector("#templateTbody tr");
  await admin.locator(`#templateTbody tr[data-id="${tid}"] [data-action="edit"]`).click();
  await admin.waitForSelector(".drawer.open");
  const newEnv = "Outdoor — urban street";
  await admin.locator('.var-row[data-key="environment"] select[data-f="value"]').selectOption(newEnv);
  await shot(admin, "admin-edit-locked-env");
  await admin.click("#publishBtn");
  await waitToast(admin, "is now live");
  await publicPage.reload();
  await publicPage.locator(".tmpl-card", { hasText: NAME }).click();
  await publicPage.waitForFunction((n) => document.getElementById("lockTitle")?.textContent === n, NAME);
  const envRow = publicPage.locator("#lockRows .lock-row", { hasText: /environment/i });
  check(`Public locked panel now shows "${newEnv}"`, (await text(envRow)).includes(newEnv), await text(envRow));
  check("It is still a read-only row (no input for it)", (await publicPage.locator("#field_environment").count()) === 0);
  await publicPage.evaluate(() => document.getElementById("studio").scrollIntoView());
  await shot(publicPage, "public-locked-updated");

  // ───────────── 2. flip to draft
  step("draft-hides", "2 · Flip the status back to draft → it disappears from the public site immediately");
  await admin.locator(`#templateTbody tr[data-id="${tid}"] [data-action="edit"]`).click();
  await admin.waitForSelector(".drawer.open");
  await admin.click("#saveDraftBtn");
  await waitToast(admin, "saved as draft");
  const pill = await pillOf(admin, tid);
  check("Admin pill now reads draft", pill === "draft", pill);
  check("Postgres row status is draft", (await db.query('select status from "Template" where id=$1', [tid])).rows[0].status === "draft");
  await publicPage.reload();
  const draftCards = await galleryCards(publicPage);
  check("Card is gone from the public gallery", !draftCards.some((t) => t.includes(NAME)), `${draftCards.length} cards`);
  const d = await publicPage.evaluate(async (id) => { const r = await fetch(`/api/templates/${id}`); return { status: r.status, text: await r.text() }; }, tid);
  check("GET /api/templates/:id → 404 for the draft", d.status === 404, `${d.status} ${d.text}`);
  const ident = await publicPage.evaluate(async () => { const r = await fetch(`/api/templates/definitely-not-real`); return r.status + " " + (await r.text()); });
  check("…indistinguishable from an id that never existed", ident.startsWith("404") && ident.includes(d.text), ident);
  const g = await publicPage.evaluate(async (id) => (await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: id, values: {} }) })).status, tid);
  check("POST /api/generate for the draft → 404", g === 404, g);
  const studio = await publicPage.goto(`${BASE}/studio/${tid}`);
  check("Deep link /studio/:id → 404 page for the draft", studio.status() === 404, studio.status());
  await shot(publicPage, "public-draft-404");
  await publicPage.goto(BASE + "/");
  await galleryCards(publicPage);

  // ───────────── status pill cycle persists
  step("pill", "Status pill cycles draft → published → archived and persists immediately");
  const pillBtn = admin.locator(`#templateTbody tr[data-id="${tid}"] .status-pill`);
  await pillBtn.click(); await admin.waitForFunction((id) => document.querySelector(`tr[data-id="${id}"] .status-pill`)?.textContent.trim() === "published", tid);
  check("draft → published (DB)", (await db.query('select status from "Template" where id=$1', [tid])).rows[0].status === "published");
  await publicPage.reload();
  check("…and it is live on the public site again", (await galleryCards(publicPage)).some((t) => t.includes(NAME)));
  await pillBtn.click(); await admin.waitForFunction((id) => document.querySelector(`tr[data-id="${id}"] .status-pill`)?.textContent.trim() === "archived", tid);
  check("published → archived (DB)", (await db.query('select status from "Template" where id=$1', [tid])).rows[0].status === "archived");
  await publicPage.reload();
  check("…and it is gone from the public site", !(await galleryCards(publicPage)).some((t) => t.includes(NAME)));
  await admin.reload(); await admin.waitForSelector("#templateTbody tr");
  check("State survives an admin page reload (persisted, not local)", (await pillOf(admin, tid)) === "archived");

  // ───────────── Ad Intelligence (live scouted-ads feed, stub provider) + Overview
  step("adspy", "Ad Intelligence and Overview");
  scoutedBefore = (await db.query('select count(*)::int n from "ScoutedAd"')).rows[0].n;
  await admin.click('a[href="/admin/ad-intelligence"]');
  await admin.waitForSelector("#view-adspy");
  if (scoutedBefore === 0) {
    await admin.waitForFunction(() => document.getElementById("spyGrid")?.textContent.includes("Sync Meta Ads"), null, { timeout: 10000 }).catch(() => {});
    check("Empty state points to Sync before anything is synced", (await text(admin.locator("#spyGrid"))).includes("Sync Meta Ads"));
    await admin.click("text=Sync Meta Ads");
    await admin.waitForSelector(".spy-card", { timeout: 15000 });
    check("Sync (stub provider) fills the feed", (await admin.locator(".spy-card").count()) >= 5, `${await admin.locator(".spy-card").count()} cards`);
  } else {
    await admin.waitForSelector(".spy-card");
  }
  await shot(admin, "admin-ad-intelligence");
  const pillBefore = await text(admin.locator(".spy-card .status-pill").first());
  await admin.locator(".spy-card .status-pill").first().click();
  await admin.waitForFunction((t) => document.querySelector(".spy-card .status-pill")?.textContent.trim() !== t, pillBefore);
  check("Approval pill toggles public voting on/off", (await text(admin.locator(".spy-card .status-pill").first())) !== pillBefore, `${pillBefore} → ${await text(admin.locator(".spy-card .status-pill").first())}`);
  await admin.locator(".spy-card [data-action=use-inspiration]").first().click();
  await admin.waitForSelector(".drawer.open");
  check("'Use as inspiration' opens the editor from Ad Intelligence", (await text(admin.locator("#drawerTitle"))).includes("Ad Intelligence"), await text(admin.locator("#drawerTitle")));
  await admin.click("#drawerCloseBtn");
  await admin.waitForSelector(".drawer.open", { state: "detached" });
  check("The ✕ button really closes the drawer", (await admin.locator(".drawer.open").count()) === 0);
  await admin.click('a[href="/admin/overview"]');
  await admin.waitForSelector("#engineBreakdown");
  check("Overview shows live stats + margin-by-engine from Postgres", (await admin.locator("#engineBreakdown > div").count()) >= 3 && (await text(admin.locator("#statsRowOverview"))).includes("Total templates"), await text(admin.locator("#engineBreakdown")));
  await shot(admin, "admin-overview");
  await admin.click('a[href="/admin"]');
  await admin.waitForSelector("#templateTbody tr");

  // ───────────── duplicate / search / delete / guard
  step("misc", "Duplicate, search, publish-guard and delete");
  await admin.locator(`#templateTbody tr[data-id="${tid}"] [data-action="duplicate"]`).click();
  await admin.waitForSelector(`#templateTbody tr:has-text("${NAME} (Copy)")`);
  const copyRow = admin.locator("#templateTbody tr", { hasText: `${NAME} (Copy)` });
  check("Duplicate creates a draft copy", (await text(copyRow.locator(".status-pill"))) === "draft");
  await admin.fill("#searchInput", "google veo");
  check("Search matches engine display name", (await admin.locator("#templateTbody tr").count()) === 2, await text(admin.locator("#listCount")));
  await admin.fill("#searchInput", "");
  // publish guard: a prompt token with no variable can't go live
  await copyRow.locator('[data-action="edit"]').click();
  await admin.waitForSelector(".drawer.open");
  await admin.fill("#f_baseprompt", "Hello {{ghostVariable}} {{script}}");
  await admin.click("#publishBtn");
  const guardToast = await waitToast(admin, "ghostVariable");
  check("Publishing a prompt with an undefined {{token}} is refused", guardToast.includes("ghostVariable"), guardToast);
  await admin.fill("#f_title", "");
  await admin.click("#saveDraftBtn");
  check("Empty name is refused with the prototype's message", (await waitToast(admin, "Give the template a name before saving.")).length > 0);
  await admin.click("#drawerCloseBtn");
  await shot(admin, "admin-guard-toast");
  // delete both (confirm() auto-accepted)
  for (const id of [(await copyRow.getAttribute("data-id")), tid]) {
    await admin.locator(`#templateTbody tr[data-id="${id}"] [data-action="edit"]`).click();
    await admin.waitForSelector(".drawer.open");
    await admin.click("#deleteBtn");
    await admin.waitForSelector(`#templateTbody tr[data-id="${id}"]`, { state: "detached" });
    await admin.waitForTimeout(400);
  }
  check("Delete removes both rows from Postgres", (await db.query('select count(*)::int n from "Template" where title like $1', [NAME + "%"])).rows[0].n === 0);
  await publicPage.reload();
  const finalCards = await galleryCards(publicPage);
  check("Public gallery is back to its original card count", finalCards.length === beforeCount, `${finalCards.length}`);
  await db.query('delete from "Generation" where "templateTitle" like $1', [NAME + "%"]); // walkthrough leaves no test rows behind
} catch (e) {
  cur?.checks.push({ label: "UNEXPECTED ERROR", pass: false, detail: String(e?.stack ?? e).slice(0, 600) });
  console.error(e);
  await admin.screenshot({ path: path.join(OUT, "ERROR-admin.png") }).catch(() => {});
  await publicPage.screenshot({ path: path.join(OUT, "ERROR-public.png") }).catch(() => {});
} finally {
  await db.query('delete from "Template" where title like $1', [NAME + "%"]).catch(() => {});
  await db.query('delete from "Generation" where "templateTitle" like $1', [NAME + "%"]).catch(() => {});
  if (typeof scoutedBefore === "number" && scoutedBefore === 0) await db.query('delete from "ScoutedAd"').catch(() => {}); // rows this run synced
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), steps }, null, 2));
  await browser.close();
  await db.end();
}
const failed = steps.flatMap((s) => s.checks).filter((c) => !c.pass);
console.log(`\n${steps.flatMap((s) => s.checks).length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
