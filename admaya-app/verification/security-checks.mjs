// Regression checks for the security/charging fixes. Starts its OWN production server (run `npm run build` first)
// against a local FAKE render provider, so no real provider is ever called or billed.
//
//   node verification/security-checks.mjs
import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { SignJWT } from "jose";
import pg from "pg";

const PORT = 3110, FAKE_PORT = 4999, BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (label, pass, detail = "") => { results.push(pass); console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`); };

// ── fake render provider ───────────────────────────────────────────────────────────────────
const fake = { mode: "ok", submitted: 0 };
const fakeServer = http.createServer((req, res) => {
  const send = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
  if (req.method === "POST") { fake.submitted++; return send({ request_id: "fake-" + fake.submitted, status: "queued", status_url: `http://127.0.0.1:${FAKE_PORT}/status/x` }); }
  if (fake.mode === "ok") return send({ request_id: "x", status: "completed", output: [{ url: "https://cdn.example.test/video.mp4" }] });
  return send({ request_id: "x", status: "failed", error: "not_enough_credits at console.higgsfield.ai (SECRET-PROVIDER-DETAIL)" });
});
await new Promise((r) => fakeServer.listen(FAKE_PORT, "127.0.0.1", r));

// ── app server with safe env ───────────────────────────────────────────────────────────────
const app = spawn("node_modules/.bin/next", ["start", "-p", String(PORT), "-H", "127.0.0.1"], {
  env: { ...process.env, HIGGSFIELD_BASE_URL: `http://127.0.0.1:${FAKE_PORT}`, HIGGSFIELD_API_KEY: "fake:fake", HIGGSFIELD_POLL_MS: "150", SIGNUP_BONUS_CREDITS: "0", ALLOW_DEV_TOPUP: "true", UPLOAD_DIR: path.resolve(".uploads-test") },
  stdio: "ignore",
});
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + "/api/templates")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// ── tiny client with a cookie jar ──────────────────────────────────────────────────────────
class Client {
  jar = {};
  async req(url, { method = "GET", json, body, headers = {} } = {}) {
    const h = { ...headers };
    if (Object.keys(this.jar).length) h.cookie = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; ");
    if (json !== undefined) h["content-type"] = "application/json";
    const res = await fetch(BASE + url, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const buf = Buffer.from(await res.arrayBuffer());
    let data; try { data = JSON.parse(buf.toString()); } catch { data = null; }
    return { status: res.status, data, buf, headers: res.headers, text: buf.toString("utf8") };
  }
}
const tag = Date.now().toString(36);
const register = async (c, n) => c.req("/api/auth/customer", { method: "POST", json: { action: "register", email: `sec-${tag}-${n}@example.test`, password: "correct-horse-1" } });
const balance = async (email) => (await db.query('select "creditBalance" b from "User" where email=$1', [email])).rows[0].b;
const template = (await db.query(`select id, "priceInr", "gstRate" from "Template" where status='published' and engine in ('Seedance','Higgsfield') order by "createdAt" limit 1`)).rows[0];
const TOTAL = template.priceInr + Math.round(template.priceInr * template.gstRate);
const genIds = []; // every Generation this run creates, so cleanup is by exact id (never by time or title)
const gen = async (c) => { const r = await c.req("/api/generate", { method: "POST", json: { templateId: template.id, values: {} } }); if (r.data?.generationId) genIds.push(r.data.generationId); return r; };

try {
  console.log("A. free credits / signup bonus");
  const A = new Client(); const regA = await register(A, "a"); const emailA = `sec-${tag}-a@example.test`;
  check("New account starts with 0 credits (no default signup bonus)", regA.status === 200 && regA.data.user.creditBalance === 0, `balance ${regA.data?.user?.creditBalance}`);
  const top = await A.req("/api/auth/customer", { method: "POST", json: { action: "topup", credits: 1_000_000_000 } });
  check("Top-up is refused in production, balance unchanged", top.status === 403 && (await balance(emailA)) === 0, `${top.status}`);
  const dup = await register(new Client(), "a");
  check("Duplicate signup → clean 409, no internals", dup.status === 409 && !/prisma|invocation/i.test(dup.text), dup.text.slice(0, 80));
  const many = []; for (let i = 0; i < 6; i++) many.push((await register(new Client(), "m" + i)).status);
  check("Signup is rate-limited (6th+ from one network → 429)", many.includes(429), many.join(","));

  console.log("B/C. provider spend needs a signed-in, paying customer");
  const anon = new Client();
  const g0 = await gen(anon);
  check("Anonymous generate still works (simulated render)", g0.status === 200 && g0.data.videoReady === false && g0.data.chargedInr === 0, `charged ${g0.data?.chargedInr}`);
  check("…and the provider was NOT called", fake.submitted === 0, `provider submissions: ${fake.submitted}`);
  const g1 = await gen(A);
  check("Signed-in with 0 credits → 402, provider not called", g1.status === 402 && fake.submitted === 0, `${g1.status} ${g1.data?.error}`);

  console.log("D. concurrent spend (race)");
  await db.query('update "User" set "creditBalance"=$1 where email=$2', [TOTAL, emailA]);
  const [r1, r2, r3] = await Promise.all([gen(A), gen(A), gen(A)]);
  const codes = [r1, r2, r3].map((r) => r.status).sort();
  check("3 parallel renders with credit for exactly 1 → one 200, two 402", codes.join() === "200,402,402", codes.join());
  check("Balance is 0 — never negative", (await balance(emailA)) === 0, `${await balance(emailA)}`);
  check("Exactly one provider job and one Order", fake.submitted === 1 && (await db.query('select count(*)::int n from "Order" o join "User" u on u.id=o."userId" where u.email=$1', [emailA])).rows[0].n === 1);
  const ok = [r1, r2, r3].find((r) => r.status === 200);
  check("Charged amount reported = price + GST", ok.data.chargedInr === TOTAL && ok.data.videoReady === true, `₹${ok.data.chargedInr}`);

  console.log("E. failed render is refunded");
  fake.mode = "fail"; await db.query('update "User" set "creditBalance"=$1 where email=$2', [TOTAL, emailA]);
  const before = fake.submitted; const orders0 = (await db.query('select count(*)::int n from "Order"')).rows[0].n;
  const gf = await gen(A);
  check("Provider failure → 502 with a plain message", gf.status === 502 && /not been charged/i.test(gf.data.error), gf.data?.error);
  check("Provider error text never reaches the customer", !/higgsfield|SECRET-PROVIDER|not_enough_credits/i.test(gf.text));
  check("Credits refunded in full; provider was called; no Order recorded", (await balance(emailA)) === TOTAL && fake.submitted === before + 1 && (await db.query('select count(*)::int n from "Order"')).rows[0].n === orders0);
  fake.mode = "ok";

  console.log("F. customer-facing metadata");
  const mine = await A.req("/api/my-ads");
  const metaKeys = new Set(mine.data.assets.flatMap((a) => Object.keys(a.metadata)));
  check("/api/my-ads exposes no provider ids or diagnostics", !["providerRequestId", "higgsfieldRequestId", "hfError", "videoUrl"].some((k) => metaKeys.has(k)), [...metaKeys].join(","));

  console.log("G. uploads");
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
  const form = (buf, name, type) => { const f = new FormData(); f.set("file", new File([buf], name, { type })); return f; };
  const up0 = await anon.req("/api/upload", { method: "POST", body: form(png, "a.png", "image/png") });
  check("Upload requires sign-in", up0.status === 401, `${up0.status}`);
  const evil = await A.req("/api/upload", { method: "POST", body: form(Buffer.from('<script>alert(1)</script>'), "evil.html", "image/png") });
  check("HTML disguised as image/png is rejected (bytes are checked, not the label)", evil.status === 400, `${evil.status} ${evil.data?.error}`);
  const good = await A.req("/api/upload", { method: "POST", body: form(png, "../../evil.html", "text/html") });
  check("A real PNG is stored under a server-generated .png name, ignoring the client filename", good.status === 200 && /^\/api\/uploads\/up_[0-9a-f-]{36}\.png$/.test(good.data?.url ?? ""), good.data?.url);
  const fileName = good.data.url.split("/").pop();
  check("File is not under /public", !fs.existsSync(path.join("public", "uploads", fileName)) && fs.existsSync(path.join(".uploads-test", fileName)));
  const own = await A.req(good.data.url);
  check("Owner can fetch it: image/png, nosniff, sandboxed CSP", own.status === 200 && own.headers.get("content-type") === "image/png" && own.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(own.headers.get("content-security-policy") ?? ""));
  const B = new Client(); await register(B, "b");
  check("Another customer and anonymous visitors get 404", (await B.req(good.data.url)).status === 404 && (await new Client().req(good.data.url)).status === 404);
  check("Path-traversal name is rejected", (await A.req("/api/uploads/..%2F..%2F.env")).status === 404);

  console.log("H. retention cleanup");
  await db.query(`update "Asset" set "expiresAt"=now()-interval '1 hour' where "storageUrl"=$1`, [good.data.url]);
  const c0 = await new Client().req("/api/cron/cleanup", { method: "POST" });
  const cBad = await new Client().req("/api/cron/cleanup", { method: "POST", headers: { authorization: "Bearer wrong-wrong-wrong-wrong" } });
  check("Cleanup endpoint rejects missing / wrong secret", c0.status === 401 && cBad.status === 401, `${c0.status}/${cBad.status}`);
  const cOk = await new Client().req("/api/cron/cleanup", { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  check("With the secret it expires the asset and deletes the file", cOk.status === 200 && !fs.existsSync(path.join(".uploads-test", fileName)) && (await db.query('select expired from "Asset" where "storageUrl"=$1', [good.data.url])).rows[0].expired === true, JSON.stringify(cOk.data));

  console.log("I. sessions");
  const forge = async (secret, aud, sub) => new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setAudience(aud).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
  const uid = (await db.query('select id from "User" where email=$1', [emailA])).rows[0].id;
  const oldDefault = await forge("default-secret-key-at-least-32-chars-long", "customer", uid);
  check("Token signed with the OLD hard-coded secret is rejected", (await new Client().req("/api/my-ads", { headers: { cookie: `admaya_customer_session=${oldDefault}` } })).status === 401);
  const adminId = (await db.query('select id from "AdminUser" limit 1')).rows[0].id;
  const custAsAdmin = await forge(process.env.SESSION_SECRET, "customer", adminId);
  check("A validly-signed CUSTOMER token cannot be used as an admin session", (await new Client().req("/api/admin/templates", { headers: { cookie: `admaya_admin=${custAsAdmin}` } })).status === 401);
  const adminAsCust = await forge(process.env.SESSION_SECRET, "admin", uid);
  check("…nor an admin-audience token as a customer session", (await new Client().req("/api/my-ads", { headers: { cookie: `admaya_customer_session=${adminAsCust}` } })).status === 401);

  console.log("J. rate limiting can't be dodged with X-Forwarded-For; CSRF; votes");
  const codesXff = []; for (let i = 1; i <= 20; i++) codesXff.push((await new Client().req("/api/admin/login", { method: "POST", headers: { "x-forwarded-for": `10.1.1.${i}` }, json: { email: `nobody-${tag}@example.test`, password: "nope" } })).status);
  check("20 wrong admin logins with 20 different X-Forwarded-For values are still throttled", codesXff.includes(429), `first 429 at attempt ${codesXff.indexOf(429) + 1}`);
  const csrf = await new Client().req("/api/auth/customer", { method: "POST", headers: { origin: "https://evil.example" }, json: { action: "login", email: "a@b.co", password: "x" } });
  check("Cross-origin POST is blocked (403)", csrf.status === 403, `${csrf.status}`);
  const hidden = (await db.query(`select id from "ScoutedAd" where "approvedForPublic"=false limit 1`)).rows[0];
  if (hidden) check("Voting on a non-approved ad → 404", (await A.req(`/api/scouted-ads/${hidden.id}/vote`, { method: "POST" })).status === 404);
  const ghost = await A.req("/api/scouted-ads/does-not-exist/vote", { method: "POST" });
  check("Voting on a nonexistent ad → clean 404, no Prisma text", ghost.status === 404 && !/prisma|invocation/i.test(ghost.text));
} catch (e) {
  results.push(false); console.error("UNEXPECTED ERROR", e);
} finally {
  // remove everything this run created
  await db.query(`delete from "User" where email like $1`, [`sec-${tag}-%`]);
  if (genIds.length) await db.query(`delete from "Generation" where id = any($1)`, [genIds]);
  fs.rmSync(".uploads-test", { recursive: true, force: true });
  await db.end(); app.kill("SIGTERM"); fakeServer.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
