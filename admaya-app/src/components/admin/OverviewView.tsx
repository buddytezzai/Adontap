"use client";

import { marginPct } from "@/lib/pricing";
import { ENGINE_LABEL } from "@/lib/types";
import { useAdmin } from "./AdminProvider";
import Stats from "./Stats";

export default function OverviewView() {
  const { templates } = useAdmin();
  const groups: Record<string, { n: number; marginSum: number }> = {};
  for (const t of templates) {
    const name = ENGINE_LABEL[t.engine];
    groups[name] ??= { n: 0, marginSum: 0 };
    groups[name].n++;
    groups[name].marginSum += marginPct(t.priceInr, t.costInr);
  }
  const engines = Object.keys(groups).sort();

  return (
    <div className="view active" id="view-overview">
      <div className="topbar">
        <div>
          <h2>Overview</h2>
          <div className="sub">Portfolio snapshot across your whole template library</div>
        </div>
      </div>
      <div className="content">
        <Stats id="statsRowOverview" />
        <div className="panel" style={{ padding: 20 }}>
          <div className="section-title">Margin by engine</div>
          <div className="section-desc">Average markup you&apos;re keeping per generation, grouped by which AI engine the template renders on.</div>
          <div id="engineBreakdown" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {engines.length === 0 && <div style={{ color: "var(--ink-faint)", fontSize: ".84rem" }}>No templates yet.</div>}
            {engines.map((eng) => {
              const g = groups[eng];
              const avgM = Math.round(g.marginSum / g.n);
              return (
                <div key={eng} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 110, fontSize: ".84rem", fontWeight: 600 }}>{eng}</div>
                  <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 6, height: 10, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(4, avgM)}%`, height: "100%", background: "linear-gradient(90deg,var(--marigold),var(--peacock))" }} />
                  </div>
                  <div style={{ width: 110, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: ".78rem", color: "var(--ink-dim)" }}>
                    {avgM}% · {g.n} tmpl{g.n > 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
