import WatermarkCanvas from "./WatermarkCanvas";
export default function Hero({ scrollTo }) {
  return (
    <div className="hero">
      <div className="wrap hero-grid">
        <div>
          <div className="eyebrow">
            AI video ads for Meta & product promotion
          </div>
          <h1>
            Pick a template. Drop in your script.{" "}
            <span className="accent">Ship the ad.</span>
          </h1>
          <p className="hero-sub">
            AdMaya.ai is a template-based AI video ad generator for brands.
            Everything except your script is locked into the template; you pay
            per video, only when you generate.
          </p>
          <div className="hero-actions">
            <button className="cta-btn" onClick={() => scrollTo("templates")}>
              Browse templates
            </button>
            <button className="ghost-btn" onClick={() => scrollTo("pricing")}>
              See pricing
            </button>
          </div>
          <div className="hero-stats">
            <div>
              <b>8</b>
              <span>ad templates live</span>
            </div>
            <div>
              <b>₹0</b>
              <span>subscription required</span>
            </div>
            <div>
              <b>₹129+</b>
              <span>per generated video</span>
            </div>
          </div>
        </div>
        <div>
          <div className="phone-wrap">
            <div className="phone">
              <div className="phone-badge">
                <span className="live-dot" />
                PREVIEW
              </div>
              <WatermarkCanvas className="phone-watermark" />
              <div className="phone-play">
                <div className="play-ring">▶</div>
              </div>
              <div className="phone-caption">
                Product Unboxing UGC · 15s · <b>AdMaya.ai</b>
              </div>
            </div>
          </div>
          <p className="hero-note">
            Every preview and export carries a visible AdMaya.ai watermark.
          </p>
        </div>
      </div>
    </div>
  );
}
