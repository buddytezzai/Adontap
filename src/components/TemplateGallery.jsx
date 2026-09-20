import { FiPlay, FiArrowRight } from "react-icons/fi";

export default function TemplateGallery({ templates, activeId, onSelect }) {
  return (
    <section id="templates" className="templates-section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Step 1 · Pick an ad format</div>
            <h2>Curated UGC & Product Ad Templates</h2>
            <p className="section-desc">
              Visual composition, lighting, camera choreography, and actor pacing are locked into each template. Customize your script and generate in seconds.
            </p>
          </div>
        </div>

        <div className="tmpl-grid">
          {templates.map((t) => {
            const isSelected = activeId === t.id;
            return (
              <div
                key={t.id}
                className={`tmpl-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelect(t.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelect(t.id)}
              >
                {/* Visual Thumbnail with Real Sample Ad Image */}
                <div className="tmpl-thumb">
                  <img
                    src={t.image}
                    alt={t.title}
                    className="tmpl-bg-img"
                    loading="lazy"
                  />
                  <div className="tmpl-thumb-gradient" />
                  
                  <div className="tmpl-thumb-header">
                    <span className="tmpl-icon-badge">{t.icon}</span>
                    <span className="tmpl-engine-tag">{t.engine}</span>
                  </div>

                  <div className="play-ring sm">
                    <FiPlay />
                  </div>

                  <div className="tmpl-dur">{t.dur}</div>
                </div>

                {/* Card Content */}
                <div className="tmpl-body">
                  <div className="tmpl-cat">{t.cat}</div>
                  <h3 className="tmpl-title">{t.title}</h3>
                  
                  <div className="tmpl-foot">
                    <div className="tmpl-price-box">
                      <span className="tmpl-price">₹{t.price}</span>
                      <span className="tmpl-price-unit">/ render</span>
                    </div>
                    <span className="tmpl-use">
                      {isSelected ? "Active in Studio" : "Use Template"} <FiArrowRight className="arrow-icon" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
