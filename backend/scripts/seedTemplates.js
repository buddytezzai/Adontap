require("dotenv").config({ path: require("node:path").join(__dirname, "../.env"), override: true });
const { getDb } = require("../src/firebase");

const templates = [
  ["unbox", "Unbox & React", "E-commerce · UGC Unboxing", "📦", "/samples/unbox.jpg", "#eaa23a", "#e15b64", 15, 149, "Seedance", "Home desk setup, natural window light", "Handheld phone-style, static crop", "Quick cuts, on-screen captions", "Okay so this just landed on my desk and I've been waiting for this all week. Let's open it up together..."],
  ["before-after", "Before / After Transform", "Beauty & Wellness Product", "✨", "/samples/before-after.jpg", "#8b7ff0", "#21a693", 12, 139, "Higgsfield", "Bright bathroom counter, soft diffused light", "Slow push-in, split-screen reveal", "Match-cut transition on beat", "Day 1 versus day 14, same light, same angle, zero filters. Here's what changed after using this every night..."],
  ["app-demo", "App Walkthrough", "App / SaaS · Screen Demo", "📱", "/samples/app-demo.jpg", "#21a693", "#8b7ff0", 20, 179, "Seedance", "Clean screen-record, device frame overlay", "Static screen capture with cursor highlight", "Feature-by-feature, captioned steps", "Here's how you go from a blank project to your first automated report in under sixty seconds..."],
  ["founder", "Founder Talks Straight", "D2C Brand · Founder Story", "🎤", "/samples/founder.jpg", "#e15b64", "#eaa23a", 30, 199, "HeyGen", "Simple studio backdrop, brand color wash", "Static medium shot, direct to camera", "Unhurried, confident, single take feel", "I started this company because I couldn't find a product that actually did what it promised. So we built one..."],
  ["review", "Customer Review, UGC Style", "Testimonial · Social Proof", "⭐", "/samples/review.jpg", "#eaa23a", "#8b7ff0", 18, 159, "HeyGen", "Casual living room, warm lamp light", "Handheld selfie-style angle", "Conversational, relaxed pauses", "I was honestly skeptical before I tried this, but three weeks in and I've already reordered twice..."],
  ["feature", "Feature Spotlight", "App / SaaS · Feature Highlight", "⚡", "/samples/feature.jpg", "#8b7ff0", "#e15b64", 15, 149, "Seedance", "Minimal UI overlay on gradient background", "Animated zoom on the feature area", "Punchy, one idea per beat", "One feature most people miss: you can automate this entire step with a single click..."],
  ["offer", "Limited-Time Offer Countdown", "E-commerce · Promo", "⏱️", "/samples/offer.jpg", "#e15b64", "#21a693", 10, 129, "Seedance", "Bold color block background, product center-frame", "Quick whip-pan, snappy cuts", "Urgent, countdown overlay", "Forty-eight hours only. Here's exactly what you get and why this price won't last..."],
  ["street", "Street Interview Reaction", "Awareness · Social Proof", "🎙️", "/samples/street.jpg", "#21a693", "#eaa23a", 22, 169, "Higgsfield", "Outdoor street backdrop, natural daylight", "Documentary handheld, mic-in-frame", "Question, pause, honest reaction", "We asked five people to try it on camera for the first time. Here's what actually happened..."],
];

function record(row) {
  const [, title, category, icon, image, colorFrom, colorTo, durationSeconds, priceInr, engine, environment, camera, pacing, script] = row;
  return {
    title, category, icon, image, colorFrom, colorTo, durationSeconds, engine, costInr: Math.round(priceInr * 0.67), priceInr, gstRate: 0.18, status: "published",
    basePrompt: `Create a ${pacing.toLowerCase()} ${durationSeconds}-second ${category.toLowerCase()} video in ${environment.toLowerCase()}. Use ${camera.toLowerCase()}. The creator says: {{script}}.`,
    variables: [
      { key: "script", label: "Script", type: "textarea", options: [], defaultValue: script, editable: true },
      { key: "environment", label: "Environment", type: "text", options: [], defaultValue: environment, editable: false },
      { key: "camera", label: "Camera movement", type: "text", options: [], defaultValue: camera, editable: false },
      { key: "pacing", label: "Pacing", type: "text", options: [], defaultValue: pacing, editable: false },
    ],
  };
}

(async () => {
  const db = getDb();
  let created = 0;
  let skipped = 0;
  for (const row of templates) {
    const ref = db.collection("templates").doc(row[0]);
    const current = await ref.get();
    if (current.exists) { skipped++; continue; }
    const now = new Date().toISOString();
    await ref.set({ ...record(row), createdAt: now, updatedAt: now });
    created++;
  }
  console.log(`Template seed complete: ${created} created, ${skipped} existing preserved.`);
})().catch((error) => { console.error(error); process.exit(1); });
