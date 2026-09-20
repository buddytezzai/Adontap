// Seeds the 8 templates that shipped in the prototypes, plus the first admin login.
// Idempotent: templates are only inserted if the table is empty (so it never overwrites your edits);
// the admin's password is refreshed from ADMIN_PASSWORD each run.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Engine, TemplateStatus, VariableDTO } from "../src/lib/types";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const V = (key: string, label: string, type: VariableDTO["type"], defaultValue: string, editable: boolean, options: string[] = []): VariableDTO =>
  ({ key, label, type, defaultValue, editable, options: type === "select" && !options.length ? [defaultValue] : options });

interface Seed {
  title: string; category: string; icon: string; colorFrom: string; colorTo: string;
  durationSeconds: number; priceInr: number; costInr: number; engine: Engine; status: TemplateStatus;
  basePrompt: string; variables: VariableDTO[];
}

// Locked-variable values/options come from vaani_prototype_6.html (what the storefront shows);
// base prompts, cost and status come from admin_dashboard.html (what the team sets).
const SEEDS: Seed[] = [
  { title: "Unbox & React", category: "E-commerce · UGC Unboxing", icon: "📦", colorFrom: "#eaa23a", colorTo: "#e15b64", durationSeconds: 15, priceInr: 149, costInr: 100, engine: "Seedance", status: "published",
    basePrompt: "A {{avatarGender}} creator unboxes the product on camera in a {{environment}}. Camera does a {{camera}}, pacing is {{pacing}}, visual style is {{style}}. They say: {{script}}",
    variables: [
      V("script", "Your script", "textarea", "Okay so this just landed on my desk and I've been waiting for this all week. Let's open it up together...", true),
      V("avatarGender", "Avatar", "select", "Female", false, ["Female", "Male", "Non-binary / neutral"]),
      V("environment", "Environment", "select", "Home desk setup, natural window light", false, ["Home desk setup, natural window light", "Studio — white cyclorama", "Retail shelf close-up"]),
      V("camera", "Camera", "select", "Handheld phone-style, static crop", false, ["Handheld phone-style, static crop", "Slow push-in", "Static lock-off"]),
      V("pacing", "Pacing", "select", "Quick cuts, on-screen captions", false, ["Quick cuts, on-screen captions", "Steady / calm", "Punchy with beat drops"]),
      V("style", "Visual style", "select", "Bright & commercial", false, ["Bright & commercial", "Cinematic", "Moody & premium"]),
    ] },
  { title: "Before / After Transform", category: "Beauty & Wellness Product", icon: "✨", colorFrom: "#8b7ff0", colorTo: "#21a693", durationSeconds: 12, priceInr: 139, costInr: 95, engine: "Higgsfield", status: "published",
    basePrompt: "A {{avatarGender}} demonstrates a visible before/after transformation using the product, filmed in a {{environment}}. Camera: {{camera}}. Pacing: {{pacing}}. Style: {{style}}. Voiceover: {{script}}",
    variables: [
      V("script", "Your script", "textarea", "Day 1 versus day 14 — same light, same angle, zero filters. Here's what changed after using this every night...", true),
      V("avatarGender", "Avatar", "select", "Female", false, ["Female", "Male", "Non-binary / neutral"]),
      V("environment", "Environment", "select", "Bright bathroom counter, soft diffused light", false, ["Bright bathroom counter, soft diffused light", "Studio — white cyclorama", "Home — living room"]),
      V("camera", "Camera", "select", "Slow push-in, split-screen reveal", false, ["Slow push-in, split-screen reveal", "Static lock-off", "Handheld follow"]),
      V("pacing", "Pacing", "select", "Match-cut transition on beat", false, ["Match-cut transition on beat", "Fast-cut (TikTok style)", "Steady / calm"]),
      V("style", "Visual style", "select", "Bright & commercial", false, ["Bright & commercial", "Cinematic", "Moody & premium"]),
    ] },
  { title: "App Walkthrough", category: "App / SaaS · Screen Demo", icon: "📱", colorFrom: "#21a693", colorTo: "#8b7ff0", durationSeconds: 20, priceInr: 179, costInr: 115, engine: "Seedance", status: "published",
    basePrompt: "A {{avatarGender}} narrates a walkthrough of the app UI in a {{environment}}, screen-recording style cut with talking head, {{camera}}, {{pacing}} pacing, {{style}} look. Narration: {{script}}",
    variables: [
      V("script", "Your script", "textarea", "Here's how you go from a blank project to your first automated report in under sixty seconds...", true),
      V("avatarGender", "Presenter voice", "select", "Female", true, ["Female", "Male", "Non-binary / neutral"]),
      V("environment", "Environment", "select", "Clean screen-record, device frame overlay", false, ["Clean screen-record, device frame overlay"]),
      V("camera", "Camera", "select", "Static screen capture with cursor highlight", false, ["Static screen capture with cursor highlight"]),
      V("pacing", "Pacing", "select", "Feature-by-feature, captioned steps", false, ["Feature-by-feature, captioned steps", "Fast-cut (TikTok style)"]),
      V("style", "Visual style", "select", "Bright & commercial", false, ["Bright & commercial", "Cinematic", "Moody & premium"]),
    ] },
  { title: "Founder Talks Straight", category: "D2C Brand · Founder Story", icon: "🎤", colorFrom: "#e15b64", colorTo: "#eaa23a", durationSeconds: 30, priceInr: 199, costInr: 130, engine: "HeyGen", status: "published",
    basePrompt: "A founder-style avatar ({{avatarGender}}) speaks direct-to-camera in a {{environment}}, {{camera}}, {{pacing}} pacing, {{style}}. Script: {{script}}",
    variables: [
      V("script", "Your script", "textarea", "I started this company because I couldn't find a product that actually did what it promised. So we built one...", true),
      V("avatarGender", "Avatar", "select", "Female", false, ["Female", "Male", "Non-binary / neutral"]),
      V("environment", "Environment", "select", "Simple studio backdrop, brand color wash", false, ["Simple studio backdrop, brand color wash"]),
      V("camera", "Camera", "select", "Static medium shot, direct to camera", false, ["Static medium shot, direct to camera"]),
      V("pacing", "Pacing", "select", "Unhurried, confident, single take feel", false, ["Unhurried, confident, single take feel"]),
      V("style", "Visual style", "select", "Bright & commercial", false, ["Bright & commercial", "Cinematic", "Moody & premium"]),
    ] },
  { title: "Customer Review, UGC Style", category: "Testimonial · Social Proof", icon: "⭐", colorFrom: "#eaa23a", colorTo: "#8b7ff0", durationSeconds: 18, priceInr: 159, costInr: 105, engine: "HeyGen", status: "published",
    basePrompt: "A {{avatarGender}} gives an authentic testimonial in a {{environment}}, {{camera}}, {{pacing}}, {{style}}. What they say: {{script}}",
    variables: [
      V("script", "Your script", "textarea", "I was honestly skeptical before I tried this, but three weeks in and I've already reordered twice...", true),
      V("avatarGender", "Avatar", "select", "Female", false, ["Female", "Male", "Non-binary / neutral"]),
      V("environment", "Environment", "select", "Casual living room, warm lamp light", false, ["Casual living room, warm lamp light"]),
      V("camera", "Camera", "select", "Handheld selfie-style angle", false, ["Handheld selfie-style angle"]),
      V("pacing", "Pacing", "select", "Conversational, relaxed pauses", false, ["Conversational, relaxed pauses"]),
      V("style", "Visual style", "select", "Bright & commercial", false, ["Bright & commercial", "Cinematic", "Moody & premium"]),
    ] },
  { title: "Feature Spotlight", category: "App / SaaS · Feature Highlight", icon: "⚡", colorFrom: "#8b7ff0", colorTo: "#e15b64", durationSeconds: 15, priceInr: 149, costInr: 95, engine: "Seedance", status: "draft",
    basePrompt: "Spotlight one product feature, {{avatarGender}} presenter, {{environment}}, {{camera}}, {{pacing}}, {{style}}. Script: {{script}}",
    variables: [
      V("script", "Your script", "textarea", "One feature most people miss: you can automate this entire step with a single click...", true),
      V("avatarGender", "Avatar", "select", "Female", false, ["Female", "Male", "Non-binary / neutral"]),
      V("environment", "Environment", "select", "Minimal UI overlay on gradient background", false, ["Minimal UI overlay on gradient background"]),
      V("camera", "Camera", "select", "Animated zoom on the feature area", false, ["Animated zoom on the feature area"]),
      V("pacing", "Pacing", "select", "Punchy, one idea per beat", false, ["Punchy, one idea per beat"]),
      V("style", "Visual style", "select", "Bright & commercial", false, ["Bright & commercial", "Cinematic", "Moody & premium"]),
    ] },
  { title: "Limited-Time Offer Countdown", category: "E-commerce · Promo", icon: "⏱️", colorFrom: "#e15b64", colorTo: "#21a693", durationSeconds: 10, priceInr: 129, costInr: 80, engine: "Seedance", status: "published",
    basePrompt: "Urgent limited-time-offer ad, {{avatarGender}} presenter, {{environment}}, {{camera}}, {{pacing}} (fast), {{style}}. Script: {{script}}",
    variables: [
      V("script", "Your script", "textarea", "Forty-eight hours only — here's exactly what you get and why this price won't last...", true),
      V("avatarGender", "Avatar", "select", "Female", false, ["Female", "Male", "Non-binary / neutral"]),
      V("environment", "Environment", "select", "Bold color block background, product center-frame", false, ["Bold color block background, product center-frame"]),
      V("camera", "Camera", "select", "Quick whip-pan, snappy cuts", false, ["Quick whip-pan, snappy cuts"]),
      V("pacing", "Pacing", "select", "Urgent, countdown overlay", false, ["Urgent, countdown overlay"]),
      V("style", "Visual style", "select", "Bright & commercial", false, ["Bright & commercial", "Cinematic", "Moody & premium"]),
    ] },
  { title: "Street Interview Reaction", category: "Awareness · Social Proof", icon: "🎙️", colorFrom: "#21a693", colorTo: "#eaa23a", durationSeconds: 22, priceInr: 169, costInr: 110, engine: "Higgsfield", status: "draft",
    basePrompt: "Street-interview style reactions to the product, {{avatarGender}} interviewees, {{environment}}, {{camera}}, {{pacing}}, {{style}}. Prompts/answers: {{script}}",
    variables: [
      V("script", "Your script / interview prompts", "textarea", "We asked five people to try it on camera for the first time — here's what actually happened...", true),
      V("avatarGender", "Avatar", "select", "Female", false, ["Female", "Male", "Non-binary / neutral"]),
      V("environment", "Environment", "select", "Outdoor street backdrop, natural daylight", true, ["Outdoor street backdrop, natural daylight", "College campus, midday", "Market street, evening lights"]),
      V("camera", "Camera", "select", "Documentary handheld, mic-in-frame", false, ["Documentary handheld, mic-in-frame"]),
      V("pacing", "Pacing", "select", "Question, pause, honest reaction", false, ["Question, pause, honest reaction"]),
      V("style", "Visual style", "select", "Bright & commercial", false, ["Bright & commercial", "Cinematic", "Moody & premium"]),
    ] },
];

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 8) throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters in .env");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.upsert({ where: { email }, update: { passwordHash }, create: { email, passwordHash } });
  console.log(`admin login ready: ${email}`);

  if ((await prisma.template.count()) > 0) {
    console.log("templates already exist — leaving them untouched");
    return;
  }
  const base = Date.now() - SEEDS.length * 1000;
  for (const [i, s] of SEEDS.entries()) {
    await prisma.template.create({
      data: {
        title: s.title, category: s.category, icon: s.icon, colorFrom: s.colorFrom, colorTo: s.colorTo,
        durationSeconds: s.durationSeconds, engine: s.engine, costInr: s.costInr, priceInr: s.priceInr,
        gstRate: 0.18, status: s.status, basePrompt: s.basePrompt,
        createdAt: new Date(base + i * 1000), // explicit, increasing: keeps gallery order = prototype order
        variables: { create: s.variables.map((v, order) => ({ ...v, sortOrder: order })) },
      },
    });
  }
  console.log(`seeded ${SEEDS.length} templates`);
}

main().finally(() => prisma.$disconnect());
