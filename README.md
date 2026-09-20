# AdMaya.ai

A template-based AI video ad generator for Meta and product promotion. Pick a template, write only the script, pay per video, and get a watermarked render. There is no subscription to Higgsfield, Seedance or any other engine.

> **Status: prototype.** The UI is a working front-end concept. Payment, rendering and the "Send to Meta Ads" / "Export" buttons are simulated. The backend is an early scaffold and is not wired to the front-end yet.

## How it works

1. **Pick a template.** There are 8 templates (UGC unboxing, before/after, app walkthrough, founder story, customer review, feature spotlight, limited-time offer, street interview). Each template locks the environment, camera, pacing and render engine.
2. **Write the script.** The script is the only editable input in the Studio.
3. **Pay per video.** A price is shown per template (₹129–₹199). Nothing is charged until you confirm.
4. **Render.** A progress bar walks through the stages, then shows a result card. Every preview carries a tiled "AdMaya.ai" canvas watermark.

The page also has a pricing section with credit packs (Starter, Creator, Agency, Enterprise). The buy buttons only show a "prototype" toast.

## Repository layout

```
.
├── src/                    React front-end (Create React App)
│   ├── App.jsx             Page composition and toast state
│   ├── components/         Navbar, Hero, TemplateGallery, Studio,
│   │                       Pricing, WatermarkCanvas, Toast
│   └── data/mockData.js    Template definitions (title, price, engine, script…)
├── public/                 Static assets and index.html
├── backend/                Express + Firebase Admin scaffold (see below)
├── vaani_prototype_3.html  Earlier single-file HTML prototype
├── AdMaya_Technical_Implementation_Plan.pdf
└── AdMaya_AI_Provider_Integration_Playbook.pdf
```

The two PDFs hold the planning material for the real implementation and for integrating the video-generation providers.

## Getting started

### Front-end

Requires Node.js 18+ and npm.

```bash
npm install
npm start        # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm start` | Dev server with hot reload |
| `npm run build` | Production build into `build/` |
| `npm test` | Jest and React Testing Library in watch mode |

**Stack:** React 19, Create React App (`react-scripts` 5), framer-motion, react-icons, recharts.

### Backend (work in progress)

```bash
cd backend
npm install
```

The backend uses Express 5, Firebase Admin (ID-token verification), helmet, cors, JWT, bcrypt, Redis, express-rate-limit and morgan. It has no `start` script yet.

Known gaps to close before it will run:

- `src/app.js` requires `./routes/authRoutes` and `src/server.js` requires `./routes/userRoutes`. Neither route file exists yet.
- `src/authMiddleware.js` imports `../config/firebase`, but the file lives at `src/firebase.js`. Move it or fix the path.
- `src/firebase.js` expects a Firebase `serviceAccountKey.json` one level above `src/`. Download it from the Firebase console and **never commit it**. It is not in `.gitignore`, so add it there first.
- `server.js` and `app.js` both create an Express app. Keep one as the entry point (`server.js` should import `app.js` and call `listen`).
- The `main` field in `backend/package.json` points to a non-existent `index.js`.

## Customising templates

Templates are plain objects in [src/data/mockData.js](src/data/mockData.js):

```js
{
  id: "unbox",
  title: "Unbox & React",
  cat: "E-commerce · UGC Unboxing",
  icon: "📦",
  c1: "#eaa23a", c2: "#e15b64",   // thumbnail gradient
  dur: "15s",
  price: 149,                     // ₹ per video
  engine: "Seedance",
  env: "…", cam: "…", pace: "…",  // locked template attributes
  script: "…",                    // default script text
}
```

Add an entry to `TEMPLATES` and it appears in the gallery and Studio automatically.

## Roadmap

- Real payments and a credit ledger
- Connect the front-end to the backend with Firebase auth
- Real render calls to the video providers (see the Provider Integration Playbook)
- Server-side watermarking and delivery of clean masters
- Real "Send to Meta Ads" export

## License

No license file is present. Add one before sharing or accepting contributions.
