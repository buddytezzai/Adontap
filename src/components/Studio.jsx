import { useMemo, useState } from "react";
import { RENDER_STAGES } from "../data/mockData";
import WatermarkCanvas from "./WatermarkCanvas";
export default function Studio({ template, showToast }) {
  const [script, setScript] = useState(template.script),
    [payOpen, setPayOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [done, setDone] = useState(false);
  const [lastId, setLastId] = useState(template.id);
  if (lastId !== template.id) {
    setLastId(template.id);
    setScript(template.script);
    setPayOpen(false);
    setBusy(false);
    setProgress(0);
    setDone(false);
  }
  const stage = useMemo(
    () =>
      RENDER_STAGES[
        Math.min(
          RENDER_STAGES.length - 1,
          Math.floor((progress / 100) * RENDER_STAGES.length),
        )
      ],
    [progress],
  );
  const confirm = () => {
    setPayOpen(false);
    setBusy(true);
    setDone(false);
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(100, p + 4 + Math.random() * 8);
      setProgress(p);
      if (p >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          setBusy(false);
          setDone(true);
          showToast(`₹${template.price} charged · video generated`);
        }, 300);
      }
    }, 140);
  };
  return (
    <section id="studio">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Step 2 · the studio</div>
            <h2>Write your script, generate, pay once</h2>
            <p className="section-desc">
              Everything about how the ad looks was decided when the template
              was built.
            </p>
          </div>
        </div>
        <div className="studio-shell">
          <aside className="studio-locked">
            <div className="locked-label">Selected template</div>
            <div className="locked-title">{template.title}</div>
            <div className="locked-cat">{template.cat}</div>
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
            <div className="lock-chip">
              🔒 locked · only the script is editable
            </div>
          </aside>
          <div className="studio-main">
            <div className="field">
              <label>Your script</label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
              />
            </div>
            <button
              className="gen-btn"
              disabled={busy || !script.trim()}
              onClick={() => {
                setDone(false);
                setPayOpen(true);
              }}
            >
              {busy ? "Generating…" : "Generate video"}
            </button>
            {payOpen && (
              <div className="pay-panel show">
                <div className="pay-row">
                  <span>Template render cost</span>
                  <b>
                    {template.title} · {template.dur}
                  </b>
                </div>
                <div className="pay-total">
                  <span>Pay to generate</span>
                  <b>₹{template.price}</b>
                </div>
                <div className="pay-actions">
                  <button className="cta-btn" onClick={confirm}>
                    Confirm & pay
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
            {busy && (
              <div className="progress-wrap show">
                <div className="progress-label">
                  <span>{stage}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            {done && (
              <div className="result-card show">
                <div className="result-preview">
                  <WatermarkCanvas className="result-watermark" />
                  <div className="phone-play">
                    <div className="play-ring">▶</div>
                  </div>
                </div>
                <div className="result-body">
                  <h4>{template.title}</h4>
                  <div className="result-meta">
                    {template.dur} · ₹{template.price} paid · {template.engine}
                  </div>
                  <div className="watermark-note">
                    <span className="dot">●</span>
                    <span>
                      Paid render. The watermark remains on preview exports.
                      Clean masters can be delivered separately.
                    </span>
                  </div>
                  <div className="export-row">
                    <button
                      onClick={() =>
                        showToast(
                          "Queued for Meta Ads Manager upload (watermarked)",
                        )
                      }
                    >
                      Send to Meta Ads
                    </button>
                    <button
                      onClick={() =>
                        showToast("Exported for Instagram Reels (watermarked)")
                      }
                    >
                      Export · Reels
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
