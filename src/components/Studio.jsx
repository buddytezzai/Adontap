import { useMemo, useState, useEffect } from "react";
import { RENDER_STAGES } from "../data/mockData";
import WatermarkCanvas from "./WatermarkCanvas";
import {
  FiLock,
  FiPlay,
  FiDownload,
  FiShare2,
  FiClock,
  FiCheckCircle,
  FiFolder,
  FiZap,
} from "react-icons/fi";

export default function Studio({
  template,
  user,
  onRequireAuth,
  onAddGeneratedAd,
  showToast,
  scrollTo,
}) {
  const [script, setScript] = useState(template.script);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [generatedAdData, setGeneratedAdData] = useState(null);
  const [lastId, setLastId] = useState(template.id);
  const [timeLeft, setTimeLeft] = useState("24h 00m 00s");

  // Reset state when active template changes
  if (lastId !== template.id) {
    setLastId(template.id);
    setScript(template.script);
    setPayOpen(false);
    setBusy(false);
    setProgress(0);
    setDone(false);
    setGeneratedAdData(null);
  }

  // Live countdown timer for the newly generated ad
  useEffect(() => {
    if (!generatedAdData) return;
    const interval = setInterval(() => {
      const diff = generatedAdData.expiresAt - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        const totalSec = Math.floor(diff / 1000);
        const hours = String(Math.floor(totalSec / 3600)).padStart(2, "0");
        const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
        const secs = String(totalSec % 60).padStart(2, "0");
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [generatedAdData]);

  const stage = useMemo(
    () =>
      RENDER_STAGES[
        Math.min(
          RENDER_STAGES.length - 1,
          Math.floor((progress / 100) * RENDER_STAGES.length)
        )
      ],
    [progress]
  );

  const handleStartGeneration = () => {
    // Check if user has logged in
    if (!user) {
      showToast("Please sign in or enter credentials to generate AI video ads");
      onRequireAuth();
      return;
    }

    setDone(false);
    setPayOpen(true);
  };

  const confirmAndRender = () => {
    setPayOpen(false);
    setBusy(true);
    setDone(false);
    setProgress(0);

    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(100, p + 5 + Math.random() * 8);
      setProgress(p);

      if (p >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          const newAd = {
            id: "ad-" + Date.now().toString(36),
            templateId: template.id,
            title: template.title,
            cat: template.cat,
            image: template.image,
            dur: template.dur,
            price: template.price,
            engine: template.engine,
            script: script.trim(),
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 3600 * 1000, // 24 hours expiry
            isWatermarked: true,
          };

          setGeneratedAdData(newAd);
          onAddGeneratedAd(newAd);
          setBusy(false);
          setDone(true);
          showToast(`₹${template.price} charged · Ad saved to 24h repository!`);
        }, 400);
      }
    }, 130);
  };

  return (
    <section id="studio" className="studio-section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Step 2 · The AI Studio</div>
            <h2>Write Your Script & Synthesize Video Ad</h2>
            <p className="section-desc">
              Visual parameters, camera choreographies, and environments are pre-locked. Modify the script, verify your credentials, and let the AI neural engine render your ad.
            </p>
          </div>
        </div>

        <div className="studio-shell">
          {/* Left Panel: Template Specifications & Visual Preview */}
          <aside className="studio-locked">
            <div className="locked-header">
              <div className="locked-label">Active Template Spec</div>
              <div className="locked-title">{template.title}</div>
              <div className="locked-cat">{template.cat}</div>
            </div>

            {/* Template Sample Frame Preview */}
            <div className="studio-thumb-preview">
              <img
                src={template.image}
                alt={template.title}
                className="studio-thumb-img"
              />
              <WatermarkCanvas className="studio-watermark-overlay" />
              <div className="studio-thumb-tag">{template.engine} Engine</div>
            </div>

            <div className="specs-list">
              {[
                ["Environment", template.env],
                ["Camera", template.cam],
                ["Pacing", template.pace],
                ["Engine", `${template.engine} · ${template.dur} render`],
              ].map(([k, v]) => (
                <div className="lock-row" key={k}>
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
              ))}
            </div>

            <div className="lock-chip">
              <FiLock /> Locked architecture · Only script is dynamically scripted
            </div>
          </aside>

          {/* Right Panel: Script Editor & Generation Action */}
          <div className="studio-main">
            <div className="field">
              <div className="field-header">
                <label>Ad Script Prompt</label>
                <span className="script-char-count">{script.length} characters</span>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Type or paste your high-converting ad copy here..."
                rows={5}
              />
            </div>

            {/* User Auth Status Indicator */}
            {!user && (
              <div className="studio-auth-notice" onClick={onRequireAuth}>
                <FiLock className="notice-icon" />
                <div className="notice-text">
                  <b>Sign in required before generation</b>
                  <span>Login credentials ensure your generated videos sync to your 24h repository.</span>
                </div>
                <button type="button" className="ghost-btn sm">
                  Sign In
                </button>
              </div>
            )}

            <button
              className="gen-btn studio-gen-btn"
              disabled={busy || !script.trim()}
              onClick={handleStartGeneration}
            >
              <FiZap />
              {busy ? "Synthesizing AI Video…" : user ? `Generate Video Ad (₹${template.price})` : "Sign In & Generate Video"}
            </button>

            {/* Payment & Confirmation Panel */}
            {payOpen && (
              <div className="pay-panel show">
                <div className="pay-header">
                  <h4>Confirm Video Ad Generation</h4>
                  <p>Neural synthesis will begin immediately upon confirmation.</p>
                </div>

                <div className="pay-row">
                  <span>Selected Template</span>
                  <b>{template.title} ({template.dur})</b>
                </div>
                <div className="pay-row">
                  <span>Neural Engine Provider</span>
                  <b>{template.engine} AI</b>
                </div>
                <div className="pay-row">
                  <span>Temporary Repository Storage</span>
                  <b>24 Hours Active</b>
                </div>

                <div className="pay-total">
                  <span>Total Due</span>
                  <b>₹{template.price}</b>
                </div>

                <div className="pay-actions">
                  <button className="cta-btn" onClick={confirmAndRender}>
                    Confirm & Synthesize
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={() => setPayOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Render Progress Stages */}
            {busy && (
              <div className="progress-wrap show">
                <div className="progress-label">
                  <span className="stage-text">
                    <span className="pulse-dot" /> {stage}
                  </span>
                  <span className="pct-text">{Math.round(progress)}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="render-hint">
                  Do not close this window while AI frames are rendering…
                </div>
              </div>
            )}

            {/* Result Card with Sample Image & 24h Expiry Counter */}
            {done && generatedAdData && (
              <div className="result-card show">
                {/* Visual Sample Frame with Watermark */}
                <div className="result-preview">
                  <img
                    src={generatedAdData.image}
                    alt={generatedAdData.title}
                    className="result-sample-img"
                  />
                  <WatermarkCanvas className="result-watermark" />
                  <div className="phone-play">
                    <div className="play-ring">
                      <FiPlay />
                    </div>
                  </div>
                </div>

                {/* Result Details & Expiration Notice */}
                <div className="result-body">
                  <div className="result-status-badge">
                    <FiCheckCircle className="badge-icon" /> AI Render Completed
                  </div>
                  <h4>{generatedAdData.title}</h4>
                  <div className="result-meta">
                    {generatedAdData.dur} · ₹{generatedAdData.price} paid · {generatedAdData.engine}
                  </div>

                  {/* 24-Hour Repository Notice & Dynamic Countdown */}
                  <div className="result-repo-alert">
                    <div className="result-repo-timer">
                      <FiClock className="timer-icon" />
                      <span>Stored in Ad Repository · Auto-deletion in: <b>{timeLeft}</b></span>
                    </div>
                    <p className="result-repo-sub">
                      Your ad is cached in your 24-hour repository. Download your MP4 or send directly to Meta Ads before auto-expiry.
                    </p>
                  </div>

                  <div className="export-row">
                    <button
                      className="cta-btn sm"
                      onClick={() =>
                        showToast(`Downloaded MP4 preview: ${generatedAdData.title}`)
                      }
                    >
                      <FiDownload /> Download MP4
                    </button>
                    <button
                      className="ghost-btn sm"
                      onClick={() =>
                        showToast("Queued for Meta Ads Manager upload")
                      }
                    >
                      <FiShare2 /> Meta Ads
                    </button>
                    <button
                      className="ghost-btn sm repo-link-btn"
                      onClick={() => scrollTo("repository")}
                    >
                      <FiFolder /> Go to Repository
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
