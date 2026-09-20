"use client";

import { marginPct } from "@/lib/pricing";
import { useAdmin } from "./AdminProvider";

export default function Stats({ id }: { id: string }) {
  const { templates: t } = useAdmin();
  const total = t.length;
  const pub = t.filter((x) => x.status === "published").length;
  const draft = t.filter((x) => x.status === "draft").length;
  const avgMargin = total ? Math.round(t.reduce((s, x) => s + marginPct(x.priceInr, x.costInr), 0) / total) : 0;
  return (
    <div className="stats-row" id={id}>
      <div className="stat-card"><div className="lbl">Total templates</div><div className="val">{total}</div></div>
      <div className="stat-card"><div className="lbl">Live on gallery</div><div className="val">{pub}</div><div className="delta">visible to customers now</div></div>
      <div className="stat-card"><div className="lbl">In draft</div><div className="val">{draft}</div><div className="delta warn">{draft ? "needs review before publish" : "all caught up"}</div></div>
      <div className="stat-card"><div className="lbl">Avg. gross margin</div><div className="val">{avgMargin}%</div><div className="delta">before gateway fees &amp; GST</div></div>
    </div>
  );
}
