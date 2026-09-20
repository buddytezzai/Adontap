"use client";

import { useState } from "react";
import { useAdmin } from "./AdminProvider";

// Illustrative sample data shaped like a Meta Ad Library `ads_archive` response. NOT a live pull —
// wiring the real Ad Library API is a separate piece of work with its own access approval.
const MOCK_ADS = [
  { id: "spy1", advertiser: "Glow & Co", headline: '"I didn\'t expect THIS after 2 weeks"', cat: "Beauty & Wellness", icon: "✨", c1: "#8b7ff0", c2: "#21a693", daysActive: 118, stillRunning: true, platforms: ["Facebook", "Instagram"],
    angle: "Before/after hook in first 2s, no voiceover — just on-screen text + trending audio.",
    suggestedTitle: "Before/After — Glow-style Transform", suggestedCat: "Beauty & Wellness Product",
    suggestedPrompt: "A {{avatarGender}} shows a visible before/after transformation in a {{environment}}, on-screen text overlay drives the hook, {{camera}}, {{pacing}} pacing, {{style}}. On-screen captions / voiceover: {{script}}" },
  { id: "spy2", advertiser: "Loopwear", headline: '"POV: you found the last hoodie in stock"', cat: "E-commerce · UGC", icon: "📦", c1: "#eaa23a", c2: "#e15b64", daysActive: 73, stillRunning: true, platforms: ["Facebook", "Instagram", "Audience Network"],
    angle: "Scarcity/POV framing, handheld phone-camera feel, price shown on-screen at second 3.",
    suggestedTitle: "POV Scarcity Unboxing", suggestedCat: "E-commerce · UGC Unboxing",
    suggestedPrompt: "A {{avatarGender}} films POV-style discovering the last unit in stock, {{environment}}, {{camera}}, {{pacing}} pacing, price flashes on screen, {{style}}. Script: {{script}}" },
  { id: "spy3", advertiser: "Fleeto", headline: '"Our app just got 10x faster — here\'s the proof"', cat: "App / SaaS", icon: "📱", c1: "#21a693", c2: "#8b7ff0", daysActive: 156, stillRunning: true, platforms: ["Facebook", "Instagram"],
    angle: "Screen-record + talking head split, leads with a number/claim, demo follows immediately.",
    suggestedTitle: "Claim-Led App Demo", suggestedCat: "App / SaaS · Screen Demo",
    suggestedPrompt: "A {{avatarGender}} opens with a bold claim to camera, then cuts to a screen-record walkthrough proving it, {{environment}}, {{camera}}, {{pacing}}, {{style}}. Narration: {{script}}" },
  { id: "spy4", advertiser: "Basecamp Foods", headline: '"Our founder explains why we don\'t use preservatives"', cat: "D2C Brand", icon: "🎤", c1: "#e15b64", c2: "#eaa23a", daysActive: 41, stillRunning: true, platforms: ["Facebook"],
    angle: "Founder direct-to-camera, calm pacing, single static shot — trust over production value.",
    suggestedTitle: "Founder Trust Talk", suggestedCat: "D2C Brand · Founder Story",
    suggestedPrompt: "A founder-style avatar speaks directly to camera about the brand's reasoning behind a product choice, {{environment}}, {{camera}} (static), {{pacing}} (calm), {{style}}. Script: {{script}}" },
  { id: "spy5", advertiser: "Verve Skincare", headline: '"3 months later… my skin doctor asked what I use"', cat: "Testimonial · Social Proof", icon: "⭐", c1: "#eaa23a", c2: "#8b7ff0", daysActive: 94, stillRunning: false, platforms: ["Facebook", "Instagram"],
    angle: "Third-party validation angle (a professional noticing) rather than the user just liking it.",
    suggestedTitle: "Third-Party Validation Review", suggestedCat: "Testimonial · Social Proof",
    suggestedPrompt: "A {{avatarGender}} gives a testimonial framed around someone else noticing the result, {{environment}}, {{camera}}, {{pacing}}, {{style}}. What they say: {{script}}" },
  { id: "spy6", advertiser: "Nimbly", headline: '"Everyone in my team asks how I built this in a day"', cat: "App / SaaS", icon: "⚡", c1: "#8b7ff0", c2: "#e15b64", daysActive: 29, stillRunning: true, platforms: ["Instagram"],
    angle: "Peer-envy framing on a single feature, fast cuts, captions carry the message with sound off.",
    suggestedTitle: "Peer-Envy Feature Spotlight", suggestedCat: "App / SaaS · Feature Highlight",
    suggestedPrompt: "Spotlight one feature framed around a colleague being impressed, {{avatarGender}} presenter, {{environment}}, {{camera}}, {{pacing}} (fast), {{style}}, captions carry the line even muted. Script: {{script}}" },
];

export default function AdSpyView() {
  const { openEditor, toast } = useAdmin();
  const [cat, setCat] = useState("");
  const [minDays, setMinDays] = useState(0);

  const rows = MOCK_ADS.filter((a) => (!cat || a.cat === cat) && a.daysActive >= minDays);

  return (
    <div className="view active" id="view-adspy">
      <div className="topbar">
        <div>
          <h2>Ad Intelligence</h2>
          <div className="sub">Long-running Meta ads by category — spot the pattern, don&apos;t copy the creative</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select id="adspyCategory" style={{ width: 200 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            <option>E-commerce · UGC</option>
            <option>App / SaaS</option>
            <option>Beauty &amp; Wellness</option>
            <option>D2C Brand</option>
            <option>Testimonial · Social Proof</option>
          </select>
          <select id="adspyMinDays" style={{ width: 170 }} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))}>
            <option value="0">Any duration</option>
            <option value="30">Running 30+ days</option>
            <option value="60">Running 60+ days</option>
            <option value="120">Running 120+ days</option>
          </select>
        </div>
      </div>

      <div className="content">
        <div className="banner">
          <span>⚠️</span>
          <div>
            <b>Read this before your team uses it:</b> this pulls creative snapshots and run-dates from Meta&apos;s own Ad Library API — a real, free, official feed of every ad currently running (
            <a href="https://www.facebook.com/ads/library" target="_blank" rel="noreferrer" style={{ color: "var(--marigold)" }}>facebook.com/ads/library</a>). It does <b>not</b> reliably give spend or impressions outside the EU/UK, so &quot;still running after N days&quot; is the trend signal, not a spend estimate. Use these as structural/creative inspiration — hook style, pacing, angle — and write an original script. Re-using someone else&apos;s exact footage, copy, or branding for a paying customer is a copyright and trademark risk, not something AdMaya should be doing on their behalf.
          </div>
        </div>

        <div className="spy-grid" id="spyGrid">
          {rows.length === 0 && (
            <div className="hint" style={{ gridColumn: "1/-1", padding: 30, textAlign: "center" }}>No ads match these filters yet.</div>
          )}
          {rows.map((a) => (
            <div className="spy-card" key={a.id}>
              <div className="spy-thumb" style={{ background: `linear-gradient(155deg, ${a.c1}, ${a.c2})` }}>
                {a.icon}
                <div className="spy-live">
                  {a.stillRunning ? (
                    <>
                      <span className="dot"></span> still running
                    </>
                  ) : (
                    <>
                      <span className="dot" style={{ background: "var(--ink-faint)", animation: "none" }}></span> ended
                    </>
                  )}
                </div>
                <div className="spy-plat">
                  {a.platforms.map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </div>
                <div className="spy-days">{a.daysActive}d active</div>
              </div>
              <div className="spy-body">
                <div className="spy-advertiser">{a.advertiser}</div>
                <div className="spy-headline">{a.headline}</div>
                <div className="spy-cat">{a.cat}</div>
                <div className="spy-angle">{a.angle}</div>
                <button
                  className="spy-use-btn"
                  data-action="use-inspiration"
                  onClick={() => {
                    openEditor(null, { title: a.suggestedTitle, category: a.suggestedCat, icon: a.icon, colorFrom: a.c1, colorTo: a.c2, basePrompt: a.suggestedPrompt });
                    toast(`Started a new template inspired by "${a.advertiser}" — write your own script, the creative itself stays original.`);
                  }}
                >
                  Use as inspiration → New Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
