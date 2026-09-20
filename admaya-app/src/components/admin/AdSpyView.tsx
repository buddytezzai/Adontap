"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "./AdminProvider";
import type { ScoutedAdDTO } from "@/lib/types";

export default function AdSpyView() {
  const { openEditor, toast } = useAdmin();
  const [ads, setAds] = useState<ScoutedAdDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [sortBy, setSortBy] = useState<"votes" | "recent">("votes");
  const [syncing, setSyncing] = useState(false);

  async function loadAds() {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/scouted-ads?category=${cat}&sortBy=${sortBy}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load scouted ads");
      const data = await res.json();
      setAds(data.ads || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAds();
  }, [cat, sortBy]);

  async function toggleApproval(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/admin/scouted-ads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedForPublic: !current }),
      });
      if (!res.ok) throw new Error("Failed to update approval");
      setAds((prev) =>
        prev.map((a) => (a.id === id ? { ...a, approvedForPublic: !current } : a)),
      );
      toast(!current ? "Approved for public voting gallery." : "Removed from public voting gallery.");
    } catch {
      toast("Couldn't update approval status.");
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/scouted-ads/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      toast(`Synced ${data.totalSynced} ads from Meta Ad Library.`);
      loadAds();
    } catch {
      toast("Sync failed. Check API credentials or network.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="view active" id="view-adspy">
      <div className="topbar">
        <div>
          <h2>Ad Intelligence &amp; Curation Pipeline</h2>
          <div className="sub">
            Real Meta ads tracked by category — customer vote queue surfaces demand for new templates
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            id="adspyCategory"
            style={{ width: 180 }}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">All categories</option>
            <option value="E-Commerce & DTC">E-Commerce &amp; DTC</option>
            <option value="Mobile Apps & SaaS">Mobile Apps &amp; SaaS</option>
            <option value="Beauty & Personal Care">Beauty &amp; Personal Care</option>
            <option value="Fitness & Wellness">Fitness &amp; Wellness</option>
            <option value="Education & Courses">Education &amp; Courses</option>
          </select>

          <select
            id="adspySort"
            style={{ width: 160 }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "votes" | "recent")}
          >
            <option value="votes">🔥 Most Voted</option>
            <option value="recent">⏱️ Recently Seen</option>
          </select>

          <button
            className="btn-secondary sm"
            onClick={handleSync}
            disabled={syncing}
            style={{ padding: "7px 12px", fontSize: "0.82rem" }}
          >
            {syncing ? "Syncing…" : "🔄 Sync Meta Ads"}
          </button>
        </div>
      </div>

      <div className="content">
        <div className="banner">
          <span>💡</span>
          <div>
            <b>Curation &amp; Community Voting Loop:</b> Toggle <b>&quot;Public Voting&quot;</b> on top-performing ads
            to publish them to the customer storefront. When customers vote for an ad format, use <b>&quot;Use as inspiration&quot;</b> to
            create an original template with your own scripted prompts.
          </div>
        </div>

        {loading && <div className="hint" style={{ padding: 30, textAlign: "center" }}>Loading scouted ads…</div>}

        <div className="spy-grid" id="spyGrid">
          {!loading && ads.length === 0 && (
            <div className="hint" style={{ gridColumn: "1/-1", padding: 30, textAlign: "center" }}>
              No scouted ads found. Click &quot;Sync Meta Ads&quot; to fetch the latest archive.
            </div>
          )}
          {ads.map((a) => {
            const daysRunning = Math.max(1, Math.round((Date.now() - new Date(a.deliveryStartDate).getTime()) / (24 * 3600 * 1000)));

            return (
              <div className="spy-card" key={a.id} style={{ display: "flex", flexDirection: "column" }}>
                <div
                  className="spy-thumb"
                  style={{
                    position: "relative",
                    background: "#161326",
                    overflow: "hidden",
                    aspectRatio: "16/10",
                  }}
                >
                  <img
                    src={a.creativeSnapshotUrl}
                    alt={a.advertiserName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div className="spy-live">
                    {a.stillRunning ? (
                      <>
                        <span className="dot"></span> still running
                      </>
                    ) : (
                      <>
                        <span className="dot" style={{ background: "var(--ink-faint)", animation: "none" }}></span> ended
                      </>
                    )}
                  </div>
                  <div className="spy-plat">
                    {a.platforms.map((p) => (
                      <span key={p}>{p}</span>
                    ))}
                  </div>
                  <div className="spy-days">{daysRunning}d active</div>

                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      background: "rgba(12,10,20,0.85)",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#eaa23a",
                    }}
                  >
                    ❤️ {a.voteCount} Customer {a.voteCount === 1 ? "Vote" : "Votes"}
                  </div>
                </div>

                <div className="spy-body" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="spy-advertiser">{a.advertiserName}</div>
                    <button
                      type="button"
                      className={`status-pill ${a.approvedForPublic ? "pill-published" : "pill-draft"}`}
                      style={{ cursor: "pointer", border: "none" }}
                      onClick={() => toggleApproval(a.id, a.approvedForPublic)}
                      title="Click to toggle public voting visibility"
                    >
                      {a.approvedForPublic ? "✓ Public Voting ON" : "🔒 Admin Only"}
                    </button>
                  </div>

                  <div className="spy-headline" style={{ marginTop: 4 }}>{a.headline}</div>
                  <div className="spy-cat">{a.category}</div>

                  <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", gap: 8 }}>
                    <button
                      className="spy-use-btn"
                      style={{ flex: 1 }}
                      data-action="use-inspiration"
                      onClick={() => {
                        openEditor(null, {
                          title: `UGC — inspired by ${a.advertiserName}`,
                          category: a.category,
                          icon: "🎬",
                          colorFrom: "#eaa23a",
                          colorTo: "#e15b64",
                          basePrompt: `A creator films an authentic UGC ad for a product in a modern setting, direct hook: "${a.headline}". They say: {{script}}`,
                          inspiredByScoutedAdId: a.id,
                        });
                        toast(`Started template from "${a.advertiserName}" (${a.voteCount} votes). Creative copy stays 100% original.`);
                      }}
                    >
                      Build Template ({a.voteCount} votes) →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
