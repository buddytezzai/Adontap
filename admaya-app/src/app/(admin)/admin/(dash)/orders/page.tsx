import { getOrdersAndRenders } from "@/lib/admin-ops";
import { inr } from "@/lib/types";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function OrdersPage() {
  const { summary, rows } = await getOrdersAndRenders();
  return (
    <div className="view active" id="view-orders">
      <div className="topbar">
        <div>
          <h2>Orders &amp; Renders</h2>
          <div className="sub">Every generation request, newest first — who ran it, what it cost, and the exact prompt the server assembled</div>
        </div>
      </div>
      <div className="content">
        <div className="stats-row">
          <div className="stat-card"><div className="lbl">Total renders</div><div className="val">{summary.totalRenders}</div></div>
          <div className="stat-card"><div className="lbl">Paid (credits)</div><div className="val">{summary.paidRenders}</div><div className="delta">signed-in customers</div></div>
          <div className="stat-card"><div className="lbl">Guest previews</div><div className="val">{summary.guestRenders}</div><div className="delta">simulated, nothing charged</div></div>
          <div className="stat-card"><div className="lbl">Revenue (incl. GST)</div><div className="val">{inr(summary.revenueInr)}</div><div className="delta">credits spent on renders</div></div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Recent renders</h3>
            <span className="sub" style={{ fontSize: ".78rem", color: "var(--ink-faint)" }}>showing latest {rows.length}</span>
          </div>
          <table>
            <thead>
              <tr><th>When</th><th>Template</th><th>Customer</th><th>Charged</th><th>Status</th><th>Prompt</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr className="empty-row"><td colSpan={6}>No renders yet. They appear here as soon as someone clicks Generate on the site.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{when(r.createdAt)}</td>
                  <td>{r.templateTitle}</td>
                  <td>{r.customer ?? <span className="tag">guest</span>}</td>
                  <td className="price-cell"><b>{r.chargedInr > 0 ? inr(r.chargedInr) : "—"}</b></td>
                  <td><span className="status-pill published static">{r.status}</span></td>
                  <td style={{ maxWidth: 360 }}>
                    <details className="prompt-details">
                      <summary>View prompt</summary>
                      <div className="prompt-preview">{r.prompt}</div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
