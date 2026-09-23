import { getSystemStatus } from "@/lib/admin-ops";

export const dynamic = "force-dynamic";

export default async function ProviderKeysPage() {
  const rows = await getSystemStatus();
  return (
    <div className="view active" id="view-provider-keys">
      <div className="topbar">
        <div>
          <h2>Provider Keys</h2>
          <div className="sub">What is connected and what isn&apos;t — the secrets themselves are never shown here</div>
        </div>
      </div>
      <div className="content">
        <div className="banner">
          <span>🔐</span>
          <div>
            <b>Keys live in the server&apos;s <code>.env</code>, not in this dashboard.</b> That is deliberate: a key stored in the database or shown in a browser can be leaked by anyone who reaches an admin session. To change one, edit <code>admaya-app/.env</code> and restart the server.
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Integrations &amp; safeguards</h3></div>
          <table>
            <thead><tr><th>Item</th><th>State</th><th>What it means</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>
                    <span className={`status-pill static ${r.level === "ok" ? "published" : r.level === "warn" ? "archived" : "draft"}`}>{r.label}</span>
                  </td>
                  <td style={{ color: "var(--ink-dim)", maxWidth: 520 }}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
