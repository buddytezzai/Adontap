export default function TemplateGallery({ templates, activeId, onSelect }) {
  return (
    <section id="templates">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Step 1 · pick a template</div>
            <h2>UGC & product ad templates</h2>
            <p className="section-desc">
              The look, environment, camera movement and pacing are locked into
              each template. You only change the script.
            </p>
          </div>
        </div>
        <div className="tmpl-grid">
          {templates.map((t) => (
            <button
              key={t.id}
              className={`tmpl-card${activeId === t.id ? " selected" : ""}`}
              onClick={() => onSelect(t.id)}
            >
              <div
                className="tmpl-thumb"
                style={{
                  background: `linear-gradient(150deg,${t.c1},${t.c2})`,
                }}
              >
                <span className="tmpl-icon">{t.icon}</span>
                <div className="play-ring">▶</div>
                <div className="tmpl-dur">{t.dur}</div>
              </div>
              <div className="tmpl-body">
                <div className="tmpl-cat">{t.cat}</div>
                <div className="tmpl-title">{t.title}</div>
                <div className="tmpl-foot">
                  <span className="tmpl-price">₹{t.price} / video</span>
                  <span className="tmpl-use">Use template →</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
