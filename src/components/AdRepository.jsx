import { useState, useEffect } from "react";
import {
  FiClock,
  FiDownload,
  FiTrash2,
  FiAlertTriangle,
  FiShare2,
  FiCopy,
  FiCheck,
  FiVideo,
  FiEye,
} from "react-icons/fi";
import WatermarkCanvas from "./WatermarkCanvas";

export default function AdRepository({
  items,
  onDelete,
  onExport,
  showToast,
  scrollTo,
}) {
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState("all"); // 'all' | 'active' | 'expiring'
  const [selectedAd, setSelectedAd] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Update current time every second for live countdown precision
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format remaining time into HH:MM:SS
  const formatTimeLeft = (expiresAt) => {
    const diff = expiresAt - now;
    if (diff <= 0) return { expired: true, text: "Expired", hours: 0, percent: 100 };
    
    const totalSec = Math.floor(diff / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    
    // 24 hours = 86400 seconds
    const elapsedPercent = Math.min(100, Math.max(0, ((86400 - totalSec) / 86400) * 100));

    const pad = (n) => String(n).padStart(2, "0");
    return {
      expired: false,
      text: `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`,
      hours,
      percent: elapsedPercent,
    };
  };

  const filteredItems = items.filter((item) => {
    const { expired, hours } = formatTimeLeft(item.expiresAt);
    if (filter === "active") return !expired;
    if (filter === "expiring") return !expired && hours < 4;
    return true;
  });

  const handleCopyScript = (item) => {
    navigator.clipboard.writeText(item.script);
    setCopiedId(item.id);
    showToast("Script copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section id="repository" className="repo-section">
      <div className="wrap">
        {/* Section Header */}
        <div className="section-head repo-head-wrap">
          <div>
            <div className="eyebrow">Personalized Video Archive</div>
            <h2>24-Hour Ad Repository</h2>
            <p className="section-desc">
              Your generated AI video ads are temporarily cached here for fast review, download, and distribution.
            </p>
          </div>
          <div className="repo-status-badge">
            <span className="pulse-dot" />
            <span><b>{items.length}</b> {items.length === 1 ? "Ad" : "Ads"} in Storage</span>
          </div>
        </div>

        {/* Prominent 24-Hour Notice Alert */}
        <div className="repo-alert-banner">
          <div className="repo-alert-icon-box">
            <FiAlertTriangle className="repo-alert-icon" />
          </div>
          <div className="repo-alert-content">
            <div className="repo-alert-title">24-Hour Auto-Deletion Policy Active</div>
            <p className="repo-alert-text">
              To guarantee optimal render performance and privacy compliance, all generated video advertisements are stored in this system for <strong>exactly 24 hours</strong> from generation time. Once the countdown expires, assets are automatically purged. Please download or export your media files promptly.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        {items.length > 0 && (
          <div className="repo-controls-bar">
            <div className="repo-filter-tabs">
              <button
                className={`repo-filter-btn ${filter === "all" ? "active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All Ads ({items.length})
              </button>
              <button
                className={`repo-filter-btn ${filter === "active" ? "active" : ""}`}
                onClick={() => setFilter("active")}
              >
                Active ({items.filter((i) => !formatTimeLeft(i.expiresAt).expired).length})
              </button>
              <button
                className={`repo-filter-btn ${filter === "expiring" ? "active" : ""}`}
                onClick={() => setFilter("expiring")}
              >
                Expiring Soon (&lt; 4h) ({items.filter((i) => {
                  const t = formatTimeLeft(i.expiresAt);
                  return !t.expired && t.hours < 4;
                }).length})
              </button>
            </div>
            <div className="repo-refresh-hint">
              <FiClock /> Real-time auto-expiring counter
            </div>
          </div>
        )}

        {/* Repository Grid */}
        {items.length === 0 ? (
          <div className="repo-empty-state">
            <div className="empty-icon-wrap">
              <FiVideo />
            </div>
            <h3>No Ads in Your Repository Yet</h3>
            <p>
              Pick an ad template above, write your script, and generate your first AI video ad. It will appear here with an active 24-hour storage window.
            </p>
            <button className="cta-btn" onClick={() => scrollTo("templates")}>
              Explore Templates
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="repo-empty-filter">
            <p>No ads match the selected filter.</p>
            <button className="ghost-btn" onClick={() => setFilter("all")}>
              Show all ads
            </button>
          </div>
        ) : (
          <div className="repo-grid">
            {filteredItems.map((item) => {
              const { expired, text, hours, percent } = formatTimeLeft(item.expiresAt);
              const isUrgent = !expired && hours < 4;

              return (
                <article
                  key={item.id}
                  className={`repo-card ${expired ? "expired" : isUrgent ? "urgent" : ""}`}
                >
                  {/* Card Visual / Thumbnail */}
                  <div className="repo-thumb-wrap">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="repo-thumb-img"
                      loading="lazy"
                    />
                    {item.isWatermarked && (
                      <WatermarkCanvas className="repo-watermark-overlay" />
                    )}
                    <div className="repo-thumb-meta">
                      <span className="repo-dur-chip">{item.dur}</span>
                      <span className="repo-engine-chip">{item.engine}</span>
                    </div>

                    <button
                      className="repo-preview-btn"
                      onClick={() => setSelectedAd(item)}
                      title="Preview video ad"
                    >
                      <FiEye /> Quick View
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="repo-body">
                    <div className="repo-top-meta">
                      <span className="repo-cat">{item.cat}</span>
                      <span className={`repo-timer-badge ${expired ? "badge-expired" : isUrgent ? "badge-urgent" : "badge-active"}`}>
                        <FiClock /> {text}
                      </span>
                    </div>

                    <h4 className="repo-title">{item.title}</h4>

                    {/* Expiration Progress Bar */}
                    <div className="repo-expiry-bar-wrap">
                      <div className="repo-expiry-labels">
                        <span>Storage window</span>
                        <span>{expired ? "Deleted" : `${Math.round(100 - percent)}% remaining`}</span>
                      </div>
                      <div className="repo-expiry-track">
                        <div
                          className={`repo-expiry-fill ${expired ? "fill-expired" : isUrgent ? "fill-urgent" : ""}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Script Snippet */}
                    <div className="repo-script-box">
                      <p className="repo-script-text">"{item.script}"</p>
                      <button
                        className="repo-copy-script-btn"
                        onClick={() => handleCopyScript(item)}
                        title="Copy script"
                      >
                        {copiedId === item.id ? <FiCheck /> : <FiCopy />}
                      </button>
                    </div>

                    {/* Actions Row */}
                    <div className="repo-actions-grid">
                      <button
                        className="repo-action-btn primary"
                        disabled={expired}
                        onClick={() => {
                          showToast(`Downloading master MP4: ${item.title}`);
                        }}
                      >
                        <FiDownload /> Download MP4
                      </button>

                      <button
                        className="repo-action-btn secondary"
                        disabled={expired}
                        onClick={() => onExport(item)}
                      >
                        <FiShare2 /> Meta Ads
                      </button>

                      <button
                        className="repo-action-btn delete"
                        onClick={() => onDelete(item.id)}
                        title="Delete from repository now"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Modal Quick View */}
        {selectedAd && (
          <div className="modal-backdrop" onClick={() => setSelectedAd(null)}>
            <div className="repo-preview-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3>{selectedAd.title}</h3>
                  <div className="modal-sub">
                    {selectedAd.dur} · {selectedAd.engine} · ₹{selectedAd.price}
                  </div>
                </div>
                <button
                  className="modal-close-btn"
                  onClick={() => setSelectedAd(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-preview-viewport">
                <img
                  src={selectedAd.image}
                  alt={selectedAd.title}
                  className="modal-preview-img"
                />
                <WatermarkCanvas className="modal-preview-watermark" />
                <div className="modal-simulated-player">
                  <div className="play-ring lg">▶</div>
                </div>
              </div>

              <div className="modal-script-section">
                <div className="modal-script-label">Ad Script:</div>
                <div className="modal-script-content">{selectedAd.script}</div>
              </div>

              <div className="modal-footer-actions">
                <button
                  className="cta-btn"
                  onClick={() => {
                    showToast(`Downloading: ${selectedAd.title}`);
                    setSelectedAd(null);
                  }}
                >
                  <FiDownload /> Download Video
                </button>
                <button
                  className="ghost-btn"
                  onClick={() => {
                    onExport(selectedAd);
                    setSelectedAd(null);
                  }}
                >
                  <FiShare2 /> Export to Meta
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
