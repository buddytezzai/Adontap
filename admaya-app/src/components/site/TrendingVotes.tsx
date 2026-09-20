"use client";

import { useEffect, useState } from "react";
import type { CustomerUserDTO, ScoutedAdDTO } from "@/lib/types";

interface Props {
  user: CustomerUserDTO | null;
  onRequireAuth: () => void;
  showToast: (msg: string) => void;
}

export default function TrendingVotes({ user, onRequireAuth, showToast }: Props) {
  const [ads, setAds] = useState<ScoutedAdDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [votingId, setVotingId] = useState<string | null>(null);

  async function loadAds() {
    try {
      setLoading(true);
      const res = await fetch(`/api/scouted-ads?category=${cat}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAds(data.ads || []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAds();
  }, [cat, user]);

  async function handleVote(adId: string) {
    if (!user) {
      showToast("Please sign in to vote for template ideas");
      onRequireAuth();
      return;
    }

    setVotingId(adId);
    try {
      const res = await fetch(`/api/scouted-ads/${adId}/vote`, { method: "POST" });
      if (!res.ok) throw new Error("Vote failed");
      const data = await res.json();
      setAds((prev) =>
        prev.map((a) =>
          a.id === adId
            ? { ...a, voteCount: data.count, hasUserVoted: data.voted }
            : a,
        ),
      );
      showToast(data.voted ? "Vote recorded! Our team builds top-voted templates." : "Vote removed.");
    } catch {
      showToast("Couldn't record vote. Please try again.");
    } finally {
      setVotingId(null);
    }
  }

  return (
    <section id="trending-votes" className="trending-votes-section" style={{ padding: "64px 0", borderTop: "1px solid var(--border-subtle, rgba(255,255,255,0.08))" }}>
      <div className="wrap">
        <div className="section-head" style={{ marginBottom: 32 }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--marigold, #eaa23a)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Community Request Queue
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", marginTop: 6 }}>
              Trending Ads · Vote for the Next Template
            </h2>
            <p className="section-desc" style={{ color: "var(--ink-dim, #94a3b8)", maxWidth: "60ch", marginTop: 8 }}>
              Real winning ad formats curated from the Meta Ad Library. Vote for formats you want us to turn into customizable AI templates.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
          {["all", "E-Commerce & DTC", "Mobile Apps & SaaS", "Beauty & Personal Care", "Fitness & Wellness", "Education & Courses"].map((c) => (
            <button
              key={c}
              type="button"
              className={`filter-chip ${cat === c ? "active" : ""}`}
              onClick={() => setCat(c)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                background: cat === c ? "var(--marigold, #eaa23a)" : "rgba(255,255,255,0.05)",
                color: cat === c ? "#1a1002" : "var(--ink-dim, #94a3b8)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {c === "all" ? "All Categories" : c}
            </button>
          ))}
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--ink-dim)" }}>Loading trending ads…</div>}

        {!loading && ads.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
            <p style={{ color: "var(--ink-dim)" }}>No ads currently open for voting in this category. Check back soon!</p>
          </div>
        )}

        <div className="spy-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {ads.map((ad) => (
            <div
              key={ad.id}
              className="vote-card"
              style={{
                background: "var(--surface, #141122)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ position: "relative", aspectRatio: "16/10", background: "#0c0a14" }}>
                <img
                  src={ad.creativeSnapshotUrl}
                  alt={ad.advertiserName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  loading="lazy"
                />
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: "rgba(12,10,20,0.85)",
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: "0.68rem",
                    fontFamily: "var(--font-mono)",
                    color: "#2dd4bf",
                  }}
                >
                  {ad.category}
                </div>
              </div>

              <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary, #f8fafc)" }}>
                  {ad.advertiserName}
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--ink-dim, #94a3b8)", margin: "6px 0 16px", flex: 1, lineHeight: 1.45 }}>
                  {ad.headline}
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: ad.hasUserVoted ? "#eaa23a" : "var(--ink-dim)" }}>
                    ❤️ {ad.voteCount} {ad.voteCount === 1 ? "Vote" : "Votes"}
                  </span>

                  <button
                    type="button"
                    className={`vote-btn ${ad.hasUserVoted ? "voted" : ""}`}
                    disabled={votingId === ad.id}
                    onClick={() => handleVote(ad.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      background: ad.hasUserVoted ? "rgba(234, 162, 58, 0.2)" : "var(--marigold, #eaa23a)",
                      border: ad.hasUserVoted ? "1px solid var(--marigold, #eaa23a)" : "none",
                      color: ad.hasUserVoted ? "var(--marigold, #eaa23a)" : "#1a1002",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {ad.hasUserVoted ? "✓ Voted" : "Vote for this →"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
