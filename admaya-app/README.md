# AdMaya — connected storefront + admin

One Next.js (App Router) app, one Postgres database, one data layer. The team dashboard **writes**
templates; the public site **reads** them. A change in `/admin` is visible on the public site on the next
load — there is no build step, cache, or sync job in between.

```
/admin/*            team dashboard   (ported from admin_dashboard_2.html)
/, /studio/[id]     public site      (ported from vaani_prototype_6.html)
/api/templates*     public, sanitised read API
/api/generate       public, server-side prompt assembly (render is stubbed)
/api/admin/*        admin-only read/write API
```

> The repo's existing Create-React-App front-end (`../src`) and Express scaffold (`../backend`) are untouched.
> This app lives in its own folder so nothing of yours was moved or deleted.

## Run it

```bash
cd admaya-app
npm install
cp .env.example .env            # then set SESSION_SECRET and ADMIN_PASSWORD
npm run db:up                   # Postgres 17 in Docker on :5433 (or point DATABASE_URL at your own)
npm run db:migrate              # apply the schema
npm run db:seed                 # 8 templates + the admin login from .env
npm run dev                     # http://localhost:3000  ·  http://localhost:3000/admin
```

Production: `npm run build && npm run db:deploy && npm start`. Sign in at `/admin/login` with `ADMIN_EMAIL` /
`ADMIN_PASSWORD` from `.env` (re-running `db:seed` resets that password; it never overwrites templates once any exist).

| Script | |
| --- | --- |
| `npm test` | unit tests for the trust-boundary logic (no DB needed) |
| `npm run typecheck` | `tsc --noEmit` |
| `node verification/walkthrough.mjs` | the full browser acceptance run (needs Chrome + a running server + the DB) |

## The public / admin rule, and where it is enforced

The one flag that decides everything is `TemplateVariable.editable`. `costInr` and `basePrompt` never reach a browser.

| Concern | Enforced by |
| --- | --- |
| Only `published` templates are public; drafts look identical to non-existent ids (404) | `where: { status: "published" }` in `src/lib/templates.ts` |
| `costInr` / `basePrompt` are not even *loaded* on the public path | explicit Prisma `select` (`publicSelect`) |
| …and cannot be added by accident later | `toPublicTemplate()` in `src/lib/public.ts` builds the object field-by-field (allow-list, no spread) |
| …and cannot be imported into client code | `templates.ts` / `auth.ts` import `server-only` (build fails otherwise) |
| Customers can only change `editable` variables | `resolveValues()` in `src/lib/generate.ts`: locked and unknown keys are dropped, the stored default is used |
| Assembled prompt stays on the server | built in `/api/generate`, stored on the `Generation` row, never in the response |
| `/admin` and `/api/admin/*` need a session | checked in the `/admin` layout **and** in every admin route handler (the API check is the real one) |

The public site renders a real input only for `editable = true` and a read-only "locked" row otherwise
(`renderStudioFields()` from the prototype, now driven by `GET /api/templates/:id`).

## Data model

`prisma/schema.prisma` — `Template`, `TemplateVariable`, `AdminUser`, `Generation`. `options` is a JSON `string[]`.
`Generation` is an addition to your spec: one row per `/api/generate` call holding the server-assembled prompt, so
the trust boundary is auditable and a real provider adapter has somewhere to read its input from.

## Deliberately stubbed (search for `TODO`)

* **Render providers** — `/api/generate` waits ~700 ms and returns success (`// TODO: swap in real provider adapter here`). `engine` is display metadata only.
* **Payment** — the charge is simulated; the server does compute the authoritative amount (`price + GST`) from the database.
* **Meta Ad Library** — Ad Intelligence is the same static mock data as the prototype.

## Where this differs from the prototypes (all intentional)

1. **Storefront pay panel now shows GST** (`₹200 + GST (18%) ₹36 → Pay ₹236`). Your spec says `gstRate` is shown publicly and the admin's "Customer pays" already included it; the prototype storefront omitted it.
2. **"8 templates live" / "₹129+" in the hero are computed** from the API (a hard-coded 8 would be wrong the moment you publish a ninth). "All 8 templates" in the Starter pack became "All templates".
3. **Seeded locked rows show more than before.** Storefront prototype templates only had script/environment/camera/pacing; the admin's base prompts also use `{{avatarGender}}` and `{{style}}`, so those exist as (locked) variables. One source of truth means both apps show the same set.
4. **Guard rails that a real database needs:** deleting a template asks for confirmation; a template can't be *published* while its base prompt references a `{{token}}` no variable defines; variable keys must be unique; a dropdown's default must be one of its options.
5. **Two prototype bugs fixed while porting:** the dropdown-options field lost focus and swallowed commas on every keystroke; and the customer's typed values were mutated onto the shared template object. Both now use proper state.
6. **Empty / loading / 404 states** exist (no published templates; `/studio/<draft>` → 404) — the static prototypes never needed them. The 3 stub sidebar items are now 3 real routes so the active state is correct.
7. `vaani_prototype_6.html` has no `<!DOCTYPE>` so browsers render it in quirks mode; the port renders in standards mode. Measured against the original *with* a DOCTYPE, layout positions are identical (a few line boxes are 3–6 px different from the raw file).

## Known limits (MVP)

* Auth is email + bcrypt + a signed 7-day cookie. No password reset, roles, MFA or audit log. Login is throttled per IP+email.
* The rate limiter (`src/lib/rate-limit.ts`) is in-memory — per process. Use Redis/Upstash when running >1 instance.
* The dashboard loads the template list when the page first loads; a second admin's edits appear on refresh (no live push).
* Public pages fetch from the API on the client. If you want the gallery in the initial HTML for SEO, render it in a server component from `listPublishedTemplates()` — same data layer, no other change.
