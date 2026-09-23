import { useState, useEffect } from "react";
import WatermarkCanvas from "./WatermarkCanvas";
import { FiPlay, FiClock, FiShield, FiStar } from "react-icons/fi";
import { TEMPLATES } from "../data/mockData";

export default function Hero({ scrollTo }) {
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Rotate through sample ad previews
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePreviewIndex((prev) => (prev + 1) % TEMPLATES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const currentTemplate = TEMPLATES[activePreviewIndex];

  return (
    <div id="hero" className="hero">
      <div className="wrap hero-grid">
        <div className="hero-content">
          <div className="eyebrow-pill">
            <FiStar className="pill-icon" /> AI Video Ads for Meta & High-Converting Brands
          </div>
          <h1>
            Pick a template. Drop in your script.{" "}
            <span className="accent">Ship the ad.</span>
          </h1>
          <p className="hero-sub">
            AdMaya creates studio-grade vertical AI video ads for your product. Locked camera angles, realistic lighting, and AI talent. Generated assets are retained in your <strong>24-Hour Repository</strong> for instant export.
          </p>

          <div className="hero-actions">
            <button className="cta-btn hero-primary-btn" onClick={() => scrollTo("templates")}>
              Browse All Templates
            </button>
            <button className="ghost-btn hero-secondary-btn" onClick={() => scrollTo("repository")}>
              <FiClock className="btn-icon" /> View 24h Repository
            </button>
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <b>8 Live</b>
              <span>High-converting templates</span>
            </div>
            <div className="stat-card">
              <b>24 Hours</b>
              <span>Temporary repository storage</span>
            </div>
            <div className="stat-card">
              <b>₹129+</b>
              <span>Per generated video ad</span>
            </div>
          </div>
        </div>

        {/* Right Phone Mockup Preview with REAL Sample Image & Watermark */}
        <div className="hero-preview-col">
          <div className="phone-wrap">
            <div className="phone">
              <div className="phone-badge">
                <span className="live-dot" />
                SAMPLE AD PREVIEW
              </div>

              {/* Real Sample Ad Image */}
              <img
                src={currentTemplate.image}
                alt={currentTemplate.title}
                className={`phone-sample-img ${isPlaying ? "playing" : ""}`}
              />

              {/* Watermark Canvas Layer on Top */}
              <WatermarkCanvas className="phone-watermark" />

              {/* Play / Interactive Overlay */}
              <div
                className="phone-play"
                onClick={() => setIsPlaying(!isPlaying)}
                title="Toggle preview state"
              >
                <div className={`play-ring ${isPlaying ? "active" : ""}`}>
                  <FiPlay className="play-icon" />
                </div>
              </div>

              {/* Phone Bottom Caption */}
              <div className="phone-caption">
                <div className="phone-caption-title">{currentTemplate.title}</div>
                <div className="phone-caption-meta">
                  {currentTemplate.cat} · {currentTemplate.dur} · <b>AdMaya.ai</b>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Switcher Dots */}
          <div className="hero-sample-dots">
            {TEMPLATES.map((t, idx) => (
              <button
                key={t.id}
                className={`sample-dot ${idx === activePreviewIndex ? "active" : ""}`}
                onClick={() => setActivePreviewIndex(idx)}
                title={`Preview ${t.title}`}
              />
            ))}
          </div>

          <p className="hero-note">
            <FiShield className="note-icon" /> Every preview carries an official AdMaya watermark. Stored in your repository for 24h.
          </p>
        </div>
      </div>
    </div>
  );
}
