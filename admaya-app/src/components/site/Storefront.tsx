"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gstFor, totalWithGst } from "@/lib/pricing";
import { ENGINE_LABEL, type GenerateResult, type PublicTemplate } from "@/lib/types";
import WatermarkCanvas from "./WatermarkCanvas";

// Ported from vaani_prototype_6.html. Same markup, same class names, same interaction flow — but the
// templates come from GET /api/templates (+ /:id on select) instead of a hard-coded array, and
// "generate" posts to /api/generate instead of only animating.

type Phase = "idle" | "pay" | "rendering" | "done";

const STAGES = [
  "Merging your script into the locked template…",
  "Sending to render engine…",
  "Rendering frames…",
  "Stamping watermark…",
  "Finalising…",
];

const grad = (c1: string, c2: string) => `linear-gradient(150deg, ${c1}, ${c2})`;
const durLabel = (t: PublicTemplate) => `${t.durationSeconds}s`;
const scrollToId = (id: string, block?: ScrollLogicalPosition) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block });

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(url, { cache: "no-store", ...init });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

export default function Storefront({
  initialTemplateId,
  scrollToStudio = false,
}: {
  initialTemplateId?: string;
  scrollToStudio?: boolean;
}) {
  const [templates, setTemplates] = useState<PublicTemplate[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [active, setActive] = useState<PublicTemplate | null>(null);
  // What the customer typed, per template — survives switching templates, like the prototype.
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});

  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [stageLabel, setStageLabel] = useState("Charging your account…");
  const [result, setResult] = useState<GenerateResult | null>(null);

  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const payRef = useRef<HTMLDivElement>(null);
  const selectSeq = useRef(0);
  const alive = useRef(true);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 2600);
  }, []);

  const resetFlow = () => {
    setPhase("idle");
    setResult(null);
  };

  const selectTemplate = useCallback(
    async (id: string, scroll: boolean, known?: PublicTemplate[]) => {
      if (phaseRef.current === "rendering") {
        toast("Hang on — your video is still rendering.");
        return;
      }
      const seq = ++selectSeq.current;
      const fromList = (known ?? templates)?.find((t) => t.id === id);
      if (fromList) setActive(fromList); // instant paint; replaced by the fresh detail below
      resetFlow();
      if (scroll) scrollToId("studio");

      const { status, body } = await fetchJson<{ template?: PublicTemplate }>(`/api/templates/${encodeURIComponent(id)}`);
      if (seq !== selectSeq.current || !alive.current) return; // a newer click won
      if (status === 404 || !body.template) {
        toast("That template is no longer available.");
        const fresh = await fetchJson<{ templates: PublicTemplate[] }>("/api/templates");
        if (fresh.body.templates && alive.current) {
          setTemplates(fresh.body.templates);
          setActive(fresh.body.templates[0] ?? null);
        }
        return;
      }
      setActive(body.template);
    },
    [templates, toast],
  );

  // Load the gallery from the API.
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const { body } = await fetchJson<{ templates: PublicTemplate[] }>("/api/templates");
        if (!alive.current) return;
        const list = body.templates ?? [];
        setTemplates(list);
        const first = list.find((t) => t.id === initialTemplateId) ?? list[0];
        if (first) {
          await selectTemplate(first.id, false, list);
          if (scrollToStudio && first.id === initialTemplateId) scrollToId("studio");
        }
      } catch {
        if (alive.current) setLoadFailed(true);
      }
    })();
    return () => {
      alive.current = false;
      clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "pay") payRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [phase]);

  // ───── renderStudioFields() — locked rows vs. real inputs, decided by `editable` ─────
  const valueOf = (t: PublicTemplate, key: string, fallback: string) => edits[t.id]?.[key] ?? fallback;
  const locked = active?.variables.filter((v) => !v.editable) ?? [];
  const editable = active?.variables.filter((v) => v.editable) ?? [];

  let lockChip = "";
  let editableBadge = "";
  if (active) {
    if (editable.length > 1) {
      lockChip = `🔒 ${locked.length} locked by AdMaya — ${editable.length} fields below are yours to edit`;
      editableBadge = `✏️ ${editable.length} things you can customize for this ad`;
    } else if (editable.length === 1) {
      const only = editable[0];
      lockChip = only.key === "script" ? "🔒 locked — only the script is editable" : `🔒 locked — only ${only.label.toLowerCase()} is editable`;
      editableBadge = only.key === "script" ? "✏️ You can customize the script for this ad" : `✏️ You can customize ${only.label.toLowerCase()} for this ad`;
    } else {
      lockChip = "🔒 fully locked — this template has nothing to edit";
      editableBadge = "";
    }
  }

  const setEdit = (t: PublicTemplate, key: string, value: string) =>
    setEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], [key]: value } }));

  // ───── generate → pay → render ─────
  const onGenerate = () => {
    setResult(null);
    setPhase("pay");
  };

  async function confirmPay() {
    const t = active;
    if (!t) return;
    setPhase("rendering");
    setPct(0);
    setStageLabel("Charging your account…");

    // Only editable variables are sent. (The server enforces this too — it doesn't trust us.)
    const values: Record<string, string> = {};
    for (const v of t.variables) if (v.editable) values[v.key] = valueOf(t, v.key, v.defaultValue);
    const request = fetchJson<GenerateResult & { error?: string }>("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: t.id, values }),
    });
    request.catch(() => {});

    // Same fake progress bar as the prototype.
    let p = 0;
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (!alive.current) {
          clearInterval(timer);
          return resolve();
        }
        p += 4 + Math.random() * 8;
        if (p >= 100) {
          p = 100;
          clearInterval(timer);
          resolve();
        }
        setPct(p);
        setStageLabel(STAGES[Math.min(STAGES.length - 1, Math.floor((p / 100) * STAGES.length))]);
      }, 140);
    });
    if (!alive.current) return;

    try {
      const { status, body } = await request;
      if (status !== 200) throw new Error(body.error ?? "Generation failed");
      await new Promise((r) => setTimeout(r, 300));
      if (!alive.current) return;
      setResult(body);
      setPhase("done");
      toast(`₹${body.totalInr} charged — video generated`);
    } catch (e) {
      setPhase("idle");
      toast(e instanceof Error ? e.message : "Generation failed");
    }
  }

  const gstPct = active ? Math.round(active.gstRate * 100) : 0;
  const rendering = phase === "rendering";

  return (
    <>
      <div className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand">
            <div className="brand-mark">A</div>
            <div className="brand-name">
              AdMaya<em>.ai</em>
            </div>
          </div>
          <nav className="topnav">
            <a href="#templates">Templates</a>
            <a href="#studio">Studio</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <button className="cta-btn" onClick={() => scrollToId("templates")}>
            Browse templates
          </button>
        </div>
      </div>

      <div className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">AI video ads for Meta &amp; product promotion</div>
            <h1>
              Pick a template. Drop in your script. <span className="accent">Ship the ad.</span>
            </h1>
            <p className="hero-sub">
              AdMaya.ai is a template-based AI video ad generator for brands — no subscription to Higgsfield, Seedance, or any other AI engine required. Everything except your script is locked into the template; you pay per video, only when you generate.
            </p>
            <div className="hero-actions">
              <button className="cta-btn" onClick={() => scrollToId("templates")}>
                Browse templates
              </button>
              <button className="ghost-btn" onClick={() => scrollToId("pricing")}>
                See pricing
              </button>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <b id="heroCount">{templates ? templates.length : "–"}</b>
                <span>ad templates live</span>
              </div>
              <div className="hero-stat">
                <b>₹0</b>
                <span>subscription required</span>
              </div>
              <div className="hero-stat">
                <b>{templates && templates.length ? `₹${Math.min(...templates.map((t) => t.priceInr))}+` : "–"}</b>
                <span>per generated video</span>
              </div>
            </div>
          </div>
          <div>
            <div className="phone-wrap">
              <div className="phone">
                <div className="phone-badge">
                  <span className="live-dot"></span>PREVIEW
                </div>
                <WatermarkCanvas className="phone-watermark" id="heroWatermark" />
                <div className="phone-play">
                  <div className="play-ring">▶</div>
                </div>
                <div className="phone-caption">
                  Product Unboxing UGC · 15s · <b>AdMaya.ai</b>
                </div>
              </div>
            </div>
            <p className="hero-note">
              Every preview and export carries a visible AdMaya.ai watermark — it can&apos;t be screenshotted or downloaded clean without going through checkout.
            </p>
          </div>
        </div>
      </div>

      <section id="templates">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">Step 1 — pick a template</div>
              <h2>UGC &amp; product ad templates</h2>
              <p className="section-desc">
                The look, environment, camera movement and pacing are locked into each template. You only ever change the script.
              </p>
            </div>
          </div>
          <div className="tmpl-grid" id="tmplGrid">
            {templates === null && !loadFailed && <div className="gallery-note">Loading templates…</div>}
            {loadFailed && <div className="gallery-note">Couldn&apos;t load templates. Refresh to try again.</div>}
            {templates?.length === 0 && <div className="gallery-note">No templates are live right now — check back soon.</div>}
            {templates?.map((t) => (
              <button
                key={t.id}
                type="button"
                className={"tmpl-card" + (active?.id === t.id ? " selected" : "")}
                data-id={t.id}
                onClick={() => selectTemplate(t.id, true)}
              >
                <div className="tmpl-thumb" style={{ background: grad(t.colorFrom, t.colorTo) }}>
                  <span className="tmpl-icon">{t.icon}</span>
                  <div className="play-ring">▶</div>
                  <div className="tmpl-dur">{durLabel(t)}</div>
                </div>
                <div className="tmpl-body">
                  <div className="tmpl-cat">{t.category}</div>
                  <div className="tmpl-title">{t.title}</div>
                  <div className="tmpl-foot">
                    <span className="tmpl-price">₹{t.priceInr} / video</span>
                    <span className="tmpl-use">Use template →</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="studio">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">Step 2 — the studio</div>
              <h2>Edit what&apos;s unlocked, generate, pay once</h2>
              <p className="section-desc">
                Every template locks in most of its look when it&apos;s built. Whatever the template&apos;s creator leaves unlocked — the script, and sometimes a few other details — is yours to change below.
              </p>
            </div>
          </div>

          {!active ? (
            <div className="studio-empty">Pick a template above to open the studio.</div>
          ) : (
            <div className="studio-shell">
              <div className="studio-locked">
                <div className="locked-label">Selected template</div>
                <div className="locked-title" id="lockTitle">{active.title}</div>
                <div className="locked-cat" id="lockCat">{active.category}</div>

                <div id="lockRows">
                  {locked.map((v) => (
                    <div className="lock-row" key={v.key}>
                      <div className="k">{v.label}</div>
                      <div className="v">{v.defaultValue}</div>
                    </div>
                  ))}
                  <div className="lock-row">
                    <div className="k">Engine</div>
                    <div className="v">
                      {ENGINE_LABEL[active.engine]} · {durLabel(active)} render
                    </div>
                  </div>
                </div>

                <div className="lock-chip" id="lockChip">{lockChip}</div>
              </div>

              <div className="studio-main">
                {editable.length > 0 && (
                  <div className="editable-badge" id="editableBadge">{editableBadge}</div>
                )}
                <div id="editableFields">
                  {editable.map((v) => {
                    const fieldId = "field_" + v.key;
                    const value = valueOf(active, v.key, v.defaultValue);
                    const onChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement>) =>
                      setEdit(active, v.key, e.target.value);
                    return (
                      <div className="field" key={v.key}>
                        <label htmlFor={fieldId}>{v.label}</label>
                        {v.type === "textarea" ? (
                          <textarea id={fieldId} data-key={v.key} value={value} onChange={onChange} />
                        ) : v.type === "select" ? (
                          <select id={fieldId} data-key={v.key} value={v.options.includes(value) ? value : v.defaultValue} onChange={onChange}>
                            {v.options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" id={fieldId} data-key={v.key} value={value} onChange={onChange} />
                        )}
                      </div>
                    );
                  })}
                </div>

                <button className="gen-btn" id="genBtn" disabled={rendering} onClick={onGenerate}>
                  Generate video
                </button>

                <div className={"pay-panel" + (phase === "pay" ? " show" : "")} id="payPanel" ref={payRef}>
                  <div className="pay-row">
                    <span>Template render cost</span>
                    <b id="payTemplateName">
                      {active.title} · {durLabel(active)}
                    </b>
                  </div>
                  {active.gstRate > 0 && (
                    <div className="pay-row">
                      <span>
                        ₹{active.priceInr} + GST ({gstPct}%)
                      </span>
                      <b id="payGst">₹{gstFor(active.priceInr, active.gstRate)}</b>
                    </div>
                  )}
                  <div className="pay-total">
                    <span>Pay to generate</span>
                    <b id="payAmount">₹{totalWithGst(active.priceInr, active.gstRate)}</b>
                  </div>
                  <div className="pay-actions">
                    <button className="cta-btn" id="confirmPayBtn" onClick={confirmPay}>
                      Confirm &amp; pay
                    </button>
                    <button className="ghost-btn" id="cancelPayBtn" onClick={() => setPhase("idle")}>
                      Cancel
                    </button>
                  </div>
                </div>

                <div className={"progress-wrap" + (rendering ? " show" : "")} id="genProgress">
                  <div className="progress-label">
                    <span id="genProgressLabel">{stageLabel}</span>
                    <span id="genProgressPct">{Math.round(pct)}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" id="genProgressFill" style={{ width: pct + "%" }}></div>
                  </div>
                </div>

                {phase === "done" && result && (
                  <div className="result-card show" id="genResult">
                    <div className="result-preview">
                      <WatermarkCanvas className="result-watermark" id="resultWatermark" />
                      <div className="phone-play">
                        <div className="play-ring">▶</div>
                      </div>
                    </div>
                    <div className="result-body">
                      <h4 id="resultTitle">{result.title}</h4>
                      <div className="result-meta" id="resultMeta">
                        {result.durationSeconds}s · ₹{result.totalInr} paid · {ENGINE_LABEL[result.engine]}
                      </div>
                      <div className="watermark-note">
                        <span className="dot">●</span>
                        <span>
                          Paid render — watermark stays on every preview and export so it can&apos;t be lifted by a screen recording. Clean masters are delivered separately to your ad account on request.
                        </span>
                      </div>
                      <div className="export-row">
                        <button onClick={() => toast("Queued for Meta Ads Manager upload (watermarked)")}>Send to Meta Ads</button>
                        <button onClick={() => toast("Exported for Instagram Reels (watermarked)")}>Export · Reels</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="pricing">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">Pricing</div>
              <h2>Credit packs — pay per video, not per month</h2>
            </div>
          </div>
          <div className="price-grid">
            <div className="price-card">
              <div className="price-tier">Starter</div>
              <div className="price-amount">₹499</div>
              <div className="price-note">First-time / trial users</div>
              <ul className="price-list">
                <li>≈3 template videos</li>
                <li>Credits never expire</li>
                <li>All templates</li>
              </ul>
              <button className="ghost-btn" onClick={() => toast("This is a prototype — no live checkout yet")}>Buy credits</button>
            </div>
            <div className="price-card featured">
              <div className="price-tier">Creator</div>
              <div className="price-amount">₹1,999</div>
              <div className="price-note">Regular solo creators &amp; small brands</div>
              <ul className="price-list">
                <li>≈13 template videos (bonus included)</li>
                <li>Priority render queue</li>
                <li>Send-to-Meta export</li>
              </ul>
              <button className="cta-btn" onClick={() => toast("This is a prototype — no live checkout yet")}>Buy credits</button>
            </div>
            <div className="price-card">
              <div className="price-tier">Agency</div>
              <div className="price-amount">₹7,999</div>
              <div className="price-note">Agencies buying in bulk for clients</div>
              <ul className="price-list">
                <li>≈55 template videos (larger bonus)</li>
                <li>Multi-brand credit pools</li>
                <li>GST invoicing</li>
              </ul>
              <button className="ghost-btn" onClick={() => toast("This is a prototype — no live checkout yet")}>Talk to us</button>
            </div>
            <div className="price-card">
              <div className="price-tier">Enterprise</div>
              <div className="price-amount">Custom</div>
              <div className="price-note">High-volume D2C &amp; app brands</div>
              <ul className="price-list">
                <li>Custom / private templates</li>
                <li>Volume-based rates</li>
                <li>Dedicated render capacity</li>
              </ul>
              <button className="ghost-btn" onClick={() => toast("This is a prototype — no live checkout yet")}>Talk to us</button>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-row">
          <div>AdMaya.ai — a product concept prototype, not a live service.</div>
          <div>माया · an illusion you script yourself</div>
        </div>
      </footer>

      <div className={"toast" + (toastShow ? " show" : "")} id="toast">{toastMsg}</div>
    </>
  );
}
