"use client";

import { useEffect, useState } from "react";
import type { AssetDTO, CustomerUserDTO } from "@/lib/types";

interface Props {
  user: CustomerUserDTO;
  showToast: (msg: string) => void;
  onTopup: () => void;
  onBrowse: () => void;
}

export default function CustomerDashboard({ user, showToast, onTopup, onBrowse }: Props) {
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  async function loadAssets() {
    try {
      setLoading(true);
      const res = await fetch("/api/my-ads", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAssets(data.assets || []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this asset from your repository now?")) return;
    try {
      const res = await fetch(`/api/my-ads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setAssets((prev) => prev.filter((a) => a.id !== id));
      showToast("Asset removed from repository.");
    } catch {
      showToast("Couldn't delete asset.");
    }
  }

  const formatCountdown = (expiresAtStr: string) => {
    const diff = new Date(expiresAtStr).getTime() - now;
    if (diff <= 0) return { expired: true, text: "Expired (Removed)", hours: 0, percent: 100 };

    const totalSec = Math.floor(diff / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const elapsedPercent = Math.min(100, Math.max(0, ((86400 - totalSec) / 86400) * 100));

    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      expired: false,
      text: `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`,
      hours,
      percent: elapsedPercent,
    };
  };

  return (
    <section id="my-ads" className="my-ads-section" style={{ padding: "64px 0", borderTop: "1px solid rgba(255,255,255,0.08)", background: "#0b0914" }}>
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--marigold, #eaa23a)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Personal Workspace · {user.email}
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", marginTop: 4 }}>
              My Ads &amp; 24-Hour Repository
            </h2>
            <p style={{ color: "var(--ink-dim, #94a3b8)", fontSize: "0.95rem", maxWidth: "60ch", marginTop: 6 }}>
              All generated video ads and uploaded assets are temporarily retained here for 24 hours. Download your deliverables before the countdown expires.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ background: "rgba(234,162,58,0.1)", border: "1px solid rgba(234,162,58,0.3)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "#eaa23a" }}>CREDIT WALLET:</span>
              <b style={{ color: "#eaa23a", fontSize: "1rem" }}>₹{user.creditBalance}</b>
              <button
                type="button"
                onClick={onTopup}
                style={{ background: "#eaa23a", color: "#1a1002", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", marginLeft: 4 }}
              >
                + Top Up
              </button>
            </div>
          </div>
        </div>

        {/* 24-Hour Retention Alert Banner */}
        <div style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 14, marginBottom: 32 }}>
          <span style={{ fontSize: "1.4rem" }}>⚠️</span>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-dim, #94a3b8)", lineHeight: 1.5 }}>
            <b style={{ color: "#fda4af" }}>24-Hour Ephemeral Storage Notice:</b> To ensure optimal render infrastructure and privacy compliance, all generated videos and uploaded assets are stored for <strong>exactly 24 hours</strong>. Once expired, files are wiped from active storage. Please download your MP4 files promptly.
          </div>
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--ink-dim)" }}>Loading your ad repository…</div>}

        {!loading && assets.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 16 }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>🎬</div>
            <h3 style={{ fontSize: "1.2rem", marginBottom: 6 }}>No active ads in your repository</h3>
            <p style={{ color: "var(--ink-dim)", fontSize: "0.88rem", marginBottom: 20 }}>
              Pick a template, write your script, and generate your first AI video ad. It will appear here with an active 24-hour countdown.
            </p>
            <button className="cta-btn" onClick={onBrowse} style={{ padding: "10px 20px", borderRadius: 8, background: "#eaa23a", color: "#1a1002", fontWeight: 700, border: "none", cursor: "pointer" }}>
              Explore Template Library
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {assets.map((a) => {
            const { expired, text, hours, percent } = formatCountdown(a.expiresAt);
            const isUrgent = !expired && hours < 4;

            return (
              <div
                key={a.id}
                style={{
                  background: "var(--surface, #141122)",
                  border: `1px solid ${expired ? "rgba(244,63,94,0.3)" : isUrgent ? "rgba(234,162,58,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  opacity: expired ? 0.65 : 1,
                }}
              >
                <div style={{ position: "relative", aspectRatio: "16/10", background: "#000", overflow: "hidden" }}>
                  {a.storageUrl.endsWith(".mp4") || a.storageUrl.includes(".mp4") ? (
                    <video
                      src={a.storageUrl}
                      controls
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <img
                      src={a.storageUrl}
                      alt={a.templateTitle}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      background: "rgba(12,10,20,0.85)",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: "0.7rem",
                      fontFamily: "var(--font-mono)",
                      color: a.type === "generated" ? "#eaa23a" : "#2dd4bf",
                    }}
                  >
                    {a.type === "generated" ? "Generated AI Video" : "Uploaded Product Asset"}
                  </div>

                  <div
                    style={{
                      position: "absolute",
                      bottom: 10,
                      right: 10,
                      background: expired ? "rgba(244,63,94,0.9)" : isUrgent ? "rgba(234,162,58,0.9)" : "rgba(20,184,166,0.9)",
                      color: expired ? "#fff" : "#000",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: "0.72rem",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                    }}
                  >
                    ⏱️ {text}
                  </div>
                </div>

                <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary, #f8fafc)" }}>
                    {a.templateTitle}
                  </div>

                  {/* Expiration Progress Bar */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                      <span>24h Retention Window</span>
                      <span>{expired ? "Expired" : `${Math.round(100 - percent)}% time left`}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${percent}%`,
                          background: expired ? "var(--accent-rose, #f43f5e)" : isUrgent ? "var(--accent-gold, #eaa23a)" : "var(--accent-teal, #14b8a6)",
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>

                  {expired && (
                    <div style={{ fontSize: "0.78rem", color: "#fda4af", background: "rgba(244,63,94,0.1)", padding: "8px 10px", borderRadius: 6 }}>
                      ⚠️ This file has expired and was removed — contact support if you need it re-rendered.
                    </div>
                  )}

                  <div style={{ marginTop: "auto", paddingTop: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    {expired ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.05)",
                          color: "var(--ink-faint)",
                          border: "none",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          cursor: "not-allowed",
                        }}
                      >
                        File Expired
                      </button>
                    ) : (
                      <a
                        href={a.storageUrl}
                        download={`${(a.templateTitle || "ad").replace(/\s+/g, "_")}.${a.storageUrl.includes(".mp4") ? "mp4" : "jpg"}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => showToast(`Downloading: ${a.templateTitle || "Deliverable"}`)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textDecoration: "none",
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "var(--marigold, #eaa23a)",
                          color: "#1a1002",
                          border: "none",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        📥 Download {a.storageUrl.includes(".mp4") ? "MP4" : "Deliverable"}
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      title="Delete now"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "var(--ink-dim)",
                        cursor: "pointer",
                      }}
                    >
                      🗑
                    </button>
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
