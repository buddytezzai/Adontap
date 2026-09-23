// Browser checks for the admin operations pages: Orders & Renders, Credit Wallets, Provider Keys, Account.
//   BASE_URL=http://localhost:3100 node verification/dashboard-checks.mjs      (server + DB must be running)
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import pg from "pg";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve("verification/output-dashboard");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const results = [];
const check = (label, pass, detail = "") => { results.push(!!pass); console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? " — " + String(detail).slice(0, 170) : ""}`); };
const text = async (loc) => ((await loc.textContent()) ?? "").replace(/\s+/g, " ").trim();
const waitToast = async (p, needle) => { await p.waitForFunction((n) => { const t = document.querySelector(".toast"); return t?.classList.contains("show") && t.textContent.includes(n); }, needle, { timeout: 10000 }); return text(p.locator(".toast")); };

const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const tag = Date.now().toString(36);
const email = `dash-${tag}@example.test`;
const userId = `dashuser${tag}`;
const genIds = [`dashgen-a-${tag}`, `dashgen-b-${tag}`];
await db.query(`insert into "User"(id,email,"passwordHash",name,"creditBalance","updatedAt") values ($1,$2,'x','Dash Tester',300,now())`, [userId, email]);
const tpl = (await db.query(`select id from "Template" limit 1`)).rows[0].id;
await db.query(`insert into "Generation"(id,"userId","templateId","templateTitle","submittedValues","assembledPrompt","chargeInr","gstInr",status) values
  ($1,$3,$4,'Dash Paid Render','{}','PROMPT-PAID-${tag} A creator films in a studio',149,27,'complete'),
  ($2,null,$4,'Dash Guest Render','{}','PROMPT-GUEST-${tag}',0,0,'complete')`, [genIds[0], genIds[1], userId, tpl]);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
const ORIGINAL_PW = process.env.ADMIN_PASSWORD;
const loginStatus = async (pw) => (await fetch(BASE + "/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: pw }) })).status;

try {
  console.log("Sign in + navigation");
  await p.goto(BASE + "/admin");
  await p.fill("#email", process.env.ADMIN_EMAIL); await p.fill("#password", ORIGINAL_PW);
  await p.click("button[type=submit]"); await p.waitForURL(BASE + "/admin"); await p.waitForSelector("#templateTbody tr");
  const nav = await p.locator(".sidebar .nav-item").allTextContents();
  check("Sidebar has Orders, Credit Wallets, Provider Keys and Account", ["Orders", "Credit Wallets", "Provider Keys", "Account"].every((n) => nav.some((t) => t.includes(n))), nav.map((t) => t.trim()).join(" | "));

  console.log("Orders & Renders");
  await p.click('a[href="/admin/orders"]'); await p.waitForSelector("#view-orders table");
  check("Page is real, not 'Coming soon'", !(await text(p.locator("main"))).includes("Coming soon"));
  const row = p.locator("tr", { hasText: "Dash Paid Render" });
  check("Paid render shows customer, ₹176 (149 + 27 GST) and status", (await text(row)).includes(email) && (await text(row)).includes("₹176"), await text(row));
  check("Guest render is labelled guest with nothing charged", /guest/.test(await text(p.locator("tr", { hasText: "Dash Guest Render" }))) && (await text(p.locator("tr", { hasText: "Dash Guest Render" }))).includes("—"));
  check("Prompt is hidden until expanded", !(await p.locator(`text=PROMPT-PAID-${tag}`).isVisible()));
  await row.locator("summary").click();
  check("'View prompt' reveals the server-assembled prompt", await p.locator(`text=PROMPT-PAID-${tag}`).isVisible());
  const stat = await text(p.locator(".stats-row"));
  check("Summary cards show totals", /Total renders/.test(stat) && /Guest previews/.test(stat) && /Revenue/.test(stat), stat);
  await p.screenshot({ path: `${OUT}/orders.png` });

  console.log("Credit Wallets");
  await p.click('a[href="/admin/wallets"]'); await p.waitForSelector("#view-wallets table");
  const wrow = p.locator("tr", { hasText: email });
  check("Customer appears with their balance (₹300)", (await text(wrow)).includes("₹300"), await text(wrow));
  await wrow.locator("button", { hasText: "Adjust credits" }).click();
  await p.fill('input[aria-label="Credits"]', "500");
  await p.click("button:has-text('＋ Add')");
  check("Add without a reason is refused", (await waitToast(p, "reason")).includes("reason"));
  await p.fill('input[aria-label="Reason"]', "Welcome bonus (test)");
  await p.click("button:has-text('＋ Add')");
  check("Adding credits confirms with the new balance (₹800)", (await waitToast(p, "Added")).includes("₹800"));
  const bal = async () => (await db.query('select "creditBalance" b from "User" where id=$1', [userId])).rows[0].b;
  check("Postgres balance is 800", (await bal()) === 800, await bal());
  const audit = (await db.query('select amount,"balanceAfter",reason,"adminEmail" from "CreditAdjustment" where "userId"=$1 order by "createdAt"', [userId])).rows;
  check("Audit row records amount, balance, reason and WHICH admin", audit.length === 1 && audit[0].amount === 500 && audit[0].balanceAfter === 800 && audit[0].reason === "Welcome bonus (test)" && audit[0].adminEmail === process.env.ADMIN_EMAIL, JSON.stringify(audit[0]));
  await p.waitForSelector(`tr:has-text("${email}") >> text=Welcome bonus`);
  check("Last adjustment shows on the row after refresh", true);
  await p.locator("tr", { hasText: email }).locator("button", { hasText: "Adjust credits" }).click();
  await p.fill('input[aria-label="Credits"]', "5000"); await p.fill('input[aria-label="Reason"]', "too much");
  await p.click("button:has-text('− Remove')");
  check("Removing more than the balance is refused", (await waitToast(p, "below zero")).includes("below zero"));
  check("…and the balance is unchanged (never negative)", (await bal()) === 800);
  await p.fill('input[aria-label="Credits"]', "200"); await p.fill('input[aria-label="Reason"]', "Refund correction (test)");
  await p.click("button:has-text('− Remove')");
  await waitToast(p, "Removed");
  check("A valid removal works (balance 600) and is audited", (await bal()) === 600 && (await db.query('select count(*)::int n from "CreditAdjustment" where "userId"=$1', [userId])).rows[0].n === 2);
  await p.screenshot({ path: `${OUT}/wallets.png` });
  await p.fill('.topbar input[placeholder="Search customers…"]', "no-such-person");
  check("Search filters customers", (await text(p.locator("#view-wallets tbody"))).includes("No customers match"));
  await p.fill('.topbar input[placeholder="Search customers…"]', "");

  console.log("Wallet API guards");
  const call = (init, url = `/api/admin/wallets/${userId}/adjust`) => fetch(BASE + url, { method: "POST", headers: { "content-type": "application/json", ...(init.headers ?? {}) }, body: JSON.stringify(init.body ?? {}) });
  check("Signed-out request → 401", (await call({ body: { amount: 10, reason: "abc" } })).status === 401);
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  check("Cross-origin request → 403", (await call({ headers: { cookie, origin: "https://evil.example" }, body: { amount: 10, reason: "abc" } })).status === 403);
  check("Amount 0 → 400", (await call({ headers: { cookie }, body: { amount: 0, reason: "abc" } })).status === 400);
  check("Fractional amount → 400", (await call({ headers: { cookie }, body: { amount: 1.5, reason: "abc" } })).status === 400);
  check("Unknown customer → 404", (await call({ headers: { cookie }, body: { amount: 10, reason: "abc" } }, "/api/admin/wallets/nope/adjust")).status === 404);
  check("Balance still 600 after all the rejected calls", (await bal()) === 600);

  console.log("Provider Keys");
  await p.click('a[href="/admin/provider-keys"]'); await p.waitForSelector("#view-provider-keys table");
  const html = await p.content();
  const secrets = [process.env.SESSION_SECRET, process.env.HIGGSFIELD_API_KEY, process.env.CRON_SECRET, process.env.ADMIN_PASSWORD].filter((s) => s && s.length >= 6);
  check("Shows a status row per integration", (await p.locator("#view-provider-keys tbody tr").count()) >= 8, `${await p.locator("#view-provider-keys tbody tr").count()} rows`);
  check(`No secret (session secret, provider key, cron secret, admin password) appears on the page — ${secrets.length} values checked`, secrets.every((s) => !html.includes(s)));
  check("Database is reported connected", (await text(p.locator("#view-provider-keys tbody tr").first())).includes("Connected"));
  await p.screenshot({ path: `${OUT}/provider-keys.png` });

  console.log("Account / password");
  await p.click('a[href="/admin/account"]'); await p.waitForSelector("#view-account form");
  check("Shows who is signed in", (await text(p.locator("#view-account"))).includes(process.env.ADMIN_EMAIL));
  const NEW = `temp-${tag}-password`;
  const fillPw = async (cur, nw, again = nw) => { await p.fill("#pw_cur", cur); await p.fill("#pw_new", nw); await p.fill("#pw_again", again); await p.click("button:has-text('Change password')"); };
  await fillPw(ORIGINAL_PW, NEW, "different");
  check("Mismatched confirmation is refused", (await waitToast(p, "don't match")).includes("don't match"));
  await fillPw("definitely-wrong", NEW);
  check("Wrong current password is refused", (await waitToast(p, "incorrect")).includes("incorrect"));
  check("Password unchanged after refusals", (await loginStatus(ORIGINAL_PW)) === 200);
  const short = await fetch(BASE + "/api/admin/account/password", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ currentPassword: ORIGINAL_PW, newPassword: "short" }) });
  check("Too-short new password → 400", short.status === 400);
  await fillPw(ORIGINAL_PW, NEW);
  check("Correct change succeeds", (await waitToast(p, "Password changed")).includes("Password changed"));
  check("New password signs in; old one no longer does", (await loginStatus(NEW)) === 200 && (await loginStatus(ORIGINAL_PW)) === 401);
  await p.screenshot({ path: `${OUT}/account.png` });
  // (The seeded password can be shorter than the 10-character minimum now enforced for changes, so it can't be
  // changed "back" through the form — cleanup below restores it directly and we verify that it works.)
} catch (e) {
  results.push(false); console.error("UNEXPECTED ERROR", e);
  await p.screenshot({ path: `${OUT}/ERROR.png` }).catch(() => {});
} finally {
  // restore the password no matter what happened above
  if ((await loginStatus(ORIGINAL_PW)) !== 200) {
    const bcrypt = (await import("bcryptjs")).default;
    await db.query(`update "AdminUser" set "passwordHash"=$1 where email=$2`, [await bcrypt.hash(ORIGINAL_PW, 10), process.env.ADMIN_EMAIL]);
    console.log("  (password restored from .env in cleanup)");
  }
  await db.query('delete from "Generation" where id = any($1)', [genIds]);
  const finalStatus = await loginStatus(ORIGINAL_PW);
  results.push(finalStatus === 200);
  console.log(`  ${finalStatus === 200 ? "PASS" : "FAIL"}  After cleanup the password in .env signs in again — HTTP ${finalStatus}`);
  await db.query('delete from "User" where id=$1', [userId]); // cascades the audit rows
  await db.end(); await browser.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
