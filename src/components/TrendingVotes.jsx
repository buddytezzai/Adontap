import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function TrendingVotes({ user, onRequireAuth, showToast }) {
  const [ads, setAds] = useState([]);
  useEffect(() => { apiFetch("/api/scouted-ads").then(({ ads: next }) => setAds(next || [])).catch(() => {}); }, []);
  async function vote(id) {
    if (!user) return onRequireAuth();
    try { const result = await apiFetch(`/api/scouted-ads/${id}/vote`, { method: "POST" }); setAds((current) => current.map((ad) => ad.id === id ? { ...ad, voteCount: result.count } : ad)); }
    catch (error) { showToast(error.message || "Vote failed"); }
  }
  if (!ads.length) return null;
  return <section className="templates-section" id="trending"><div className="wrap"><div className="section-head"><div><div className="eyebrow">Community intelligence</div><h2>Trending ad formats</h2><p className="section-desc">Vote for the creative patterns you want to see turned into original templates.</p></div></div><div className="tmpl-grid">{ads.map((ad) => <article className="tmpl-card" key={ad.id}><div className="tmpl-thumb" style={{ background: "linear-gradient(145deg,#8b7ff0,#21a693)" }}><img src={ad.creativeSnapshotUrl} alt={ad.advertiserName} className="tmpl-bg-img" /></div><div className="tmpl-body"><div className="tmpl-cat">{ad.category}</div><h3 className="tmpl-title">{ad.headline}</h3><button className="ghost-btn sm" onClick={() => vote(ad.id)}>▲ Vote ({ad.voteCount || 0})</button></div></article>)}</div></div></section>;
}
