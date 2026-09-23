import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, firebaseConfigured } from "../firebase";
import { apiFetch } from "../api";
import "./AdminDashboard.css";
import "./AdminMetrics.css";
import "./AdminOps.css";

const emptyTemplate = {
  title: "",
  category: "",
  icon: "📦",
  durationSeconds: 15,
  engine: "Seedance",
  priceInr: 150,
  costInr: 100,
  gstRate: 0.18,
  image: "/samples/unbox.jpg",
  colorFrom: "#eaa23a",
  colorTo: "#e15b64",
  status: "draft",
  basePrompt: "Create a high-converting video ad. {{script}}",
  variables: [{ key: "script", label: "Script", type: "textarea", defaultValue: "", editable: true }],
};

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!auth || !firebaseConfigured) {
      setError("Firebase is not configured. Add the REACT_APP_FIREBASE_* values to .env.");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await onLogin();
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-mark">Am</div>
        <p className="admin-kicker">AdMaya.ai · Team Dashboard</p>
        <h1>Sign in to admin</h1>
        <p className="admin-muted">Only Firebase users granted the admin role can enter this workspace.</p>
        {error && <div className="admin-error">{error}</div>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="admin-primary" disabled={busy}>{busy ? "Checking access…" : "Sign in"}</button>
      </form>
    </main>
  );
}

function TemplateEditor({ value, onChange, onClose, onSave }) {
  const patch = (key, next) => onChange({ ...value, [key]: next });
  const patchVariable = (index, key, next) => onChange({ ...value, variables: value.variables.map((variable, position) => position === index ? { ...variable, [key]: next } : variable) });
  const addVariable = () => onChange({ ...value, variables: [...(value.variables || []), { key: `variable_${Date.now()}`, label: "New variable", type: "text", options: [], defaultValue: "", editable: false }] });
  return (
    <div className="admin-overlay">
      <form className="admin-drawer" onSubmit={(event) => { event.preventDefault(); onSave(value); }}>
        <div className="admin-drawer-head"><div><p className="admin-kicker">Template library</p><h2>{value.id ? "Edit template" : "New template"}</h2></div><button type="button" onClick={onClose}>×</button></div>
        <label>Template name<input value={value.title} onChange={(event) => patch("title", event.target.value)} required /></label>
        <label>Category<input value={value.category} onChange={(event) => patch("category", event.target.value)} /></label>
        <div className="admin-two-col"><label>Duration (seconds)<input type="number" min="1" value={value.durationSeconds} onChange={(event) => patch("durationSeconds", Number(event.target.value))} /></label><label>Engine<select value={value.engine} onChange={(event) => patch("engine", event.target.value)}><option>Seedance</option><option>Higgsfield</option><option>Runway</option><option>HeyGen</option></select></label></div>
        <div className="admin-two-col"><label>Cost (INR)<input type="number" min="0" value={value.costInr} onChange={(event) => patch("costInr", Number(event.target.value))} /></label><label>Price (INR)<input type="number" min="1" value={value.priceInr} onChange={(event) => patch("priceInr", Number(event.target.value))} /></label></div>
        <div className="admin-two-col"><label>GST rate<input type="number" min="0" max="1" step="0.01" value={value.gstRate ?? 0.18} onChange={(event) => patch("gstRate", Number(event.target.value))} /></label><label>Preview image<input value={value.image || ""} onChange={(event) => patch("image", event.target.value)} placeholder="/samples/unbox.jpg" /></label></div>
        <div className="admin-two-col"><label>Card color from<input value={value.colorFrom || "#eaa23a"} onChange={(event) => patch("colorFrom", event.target.value)} /></label><label>Card color to<input value={value.colorTo || "#e15b64"} onChange={(event) => patch("colorTo", event.target.value)} /></label></div>
        <label>Base video prompt<textarea rows="7" value={value.basePrompt} onChange={(event) => patch("basePrompt", event.target.value)} /></label>
        <label>Status<select value={value.status || "draft"} onChange={(event) => patch("status", event.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        <h3 className="admin-editor-section">Customer-editable variables</h3>
        {(value.variables || []).map((variable, index) => <div className="admin-variable" key={`${variable.key}-${index}`}><input value={variable.label} onChange={(event) => patchVariable(index, "label", event.target.value)} placeholder="Label" /><select value={variable.type} onChange={(event) => patchVariable(index, "type", event.target.value)}><option value="text">Text</option><option value="textarea">Textarea</option><option value="select">Select</option><option value="image">Image</option></select><input value={variable.defaultValue || ""} onChange={(event) => patchVariable(index, "defaultValue", event.target.value)} placeholder="Default value" /><label className="admin-check"><input type="checkbox" checked={variable.editable === true} onChange={(event) => patchVariable(index, "editable", event.target.checked)} /> Editable</label></div>)}
        <button type="button" className="admin-secondary" onClick={addVariable}>＋ Add variable</button>
        <div className="admin-drawer-actions"><button type="button" className="admin-secondary" onClick={onClose}>Cancel</button><button type="button" className="admin-secondary" onClick={() => onSave({ ...value, status: "draft" })}>Save draft</button><button type="button" className="admin-primary" onClick={() => onSave({ ...value, status: "published" })}>Save &amp; publish</button></div>
      </form>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [templates, setTemplates] = useState([]);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orders, setOrders] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [providerStatus, setProviderStatus] = useState(null);
  const [scoutedAds, setScoutedAds] = useState([]);

  async function load() {
    try { setTemplates((await apiFetch("/api/admin/templates")).templates || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { apiFetch("/api/admin/overview").then(setOverview).catch(() => {}); }, []);
  useEffect(() => {
    apiFetch("/api/admin/orders").then(({ orders: next }) => setOrders(next || [])).catch(() => {});
    apiFetch("/api/admin/wallets").then(({ wallets: next }) => setWallets(next || [])).catch(() => {});
    apiFetch("/api/admin/provider-status").then(setProviderStatus).catch(() => {});
    apiFetch("/api/admin/scouted-ads").then(({ ads: next }) => setScoutedAds(next || [])).catch(() => {});
  }, []);

  async function save(template) {
    try {
      const body = { ...template, variables: template.variables || emptyTemplate.variables };
      const result = await apiFetch(template.id ? `/api/admin/templates/${template.id}` : "/api/admin/templates", { method: template.id ? "PATCH" : "POST", body: JSON.stringify(body) });
      setTemplates((current) => template.id ? current.map((item) => item.id === template.id ? result.template : item) : [result.template, ...current]);
      setEditor(null);
    } catch (err) { setError(err.message); }
  }

  async function remove(id) {
    if (!window.confirm("Delete this template?")) return;
    try { await apiFetch(`/api/admin/templates/${id}`, { method: "DELETE" }); setTemplates((current) => current.filter((item) => item.id !== id)); }
    catch (err) { setError(err.message); }
  }

  async function updateStatus(template, status) {
    try { const result = await apiFetch(`/api/admin/templates/${template.id}`, { method: "PATCH", body: JSON.stringify({ ...template, status }) }); setTemplates((current) => current.map((item) => item.id === template.id ? result.template : item)); }
    catch (err) { setError(err.message); }
  }

  async function duplicate(template) {
    try { const result = await apiFetch(`/api/admin/templates/${template.id}/duplicate`, { method: "POST" }); setTemplates((current) => [result.template, ...current]); }
    catch (err) { setError(err.message); }
  }

  async function adjustWallet(id) {
    const raw = window.prompt("Credit adjustment (positive or negative whole number):", "100");
    if (!raw) return;
    try { await apiFetch(`/api/admin/wallets/${id}/adjust`, { method: "POST", body: JSON.stringify({ amount: Number(raw), reason: "Admin dashboard adjustment" }) }); setWallets((current) => current.map((wallet) => wallet.id === id ? { ...wallet, creditBalance: Number(wallet.creditBalance || 0) + Number(raw) } : wallet)); }
    catch (err) { setError(err.message); }
  }

  async function syncAds() {
    try { const result = await apiFetch("/api/admin/scouted-ads/sync", { method: "POST" }); setScoutedAds((current) => [...(result.ads || []), ...current]); }
    catch (err) { setError(err.message); }
  }

  async function toggleScoutedApproval(ad) {
    try { const result = await apiFetch(`/api/admin/scouted-ads/${ad.id}`, { method: "PATCH", body: JSON.stringify({ approvedForPublic: !ad.approvedForPublic }) }); setScoutedAds((current) => current.map((item) => item.id === ad.id ? result.ad : item)); }
    catch (err) { setError(err.message); }
  }

  return <div className="admin-shell">
    <aside className="admin-sidebar"><div className="admin-brand"><span className="admin-mark small">Am</span><span>AdMaya<em>.ai</em><small>Team Dashboard</small></span></div><nav><a className="active" href="/admin">▦ Templates <b>{templates.length}</b></a><a href="#overview">◐ Overview</a><a href="#orders">⎘ Orders & Renders</a><a href="#wallets">⛁ Credit Wallets</a></nav><div className="admin-user"><strong>{user.email}</strong><span>Firebase admin</span><button onClick={onLogout}>Sign out</button></div></aside>
    <main className="admin-main"><header className="admin-topbar"><div><p className="admin-kicker">Operations</p><h1>Template library</h1><p className="admin-muted">Manage the formats customers use to generate their ads.</p></div><div className="admin-toolbar"><input placeholder="Search templates…" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select><button className="admin-primary" onClick={() => setEditor({ ...emptyTemplate })}>＋ New template</button></div></header>
      <section className="admin-content">{overview && <div className="admin-metrics"><div><small>Published templates</small><strong>{overview.templates.published}</strong></div><div><small>Renders</small><strong>{overview.generations.total}</strong></div><div><small>Revenue</small><strong>₹{overview.generations.revenueInr}</strong></div><div><small>Customers</small><strong>{overview.users}</strong></div></div>}{error && <div className="admin-error">{error}</div>}{loading ? <p className="admin-muted">Loading templates…</p> : <div className="admin-table"><div className="admin-table-head"><span>Template</span><span>Engine</span><span>Duration</span><span>Price</span><span>Status</span><span /></div>{templates.filter((template) => (!search || `${template.title} ${template.category} ${template.engine}`.toLowerCase().includes(search.toLowerCase())) && (statusFilter === "all" || template.status === statusFilter)).map((template) => <div className="admin-table-row" key={template.id}><div><strong>{template.icon || "📦"} {template.title}</strong><small>{template.category || "Uncategorized"}</small></div><span>{template.engine}</span><span>{template.durationSeconds}s</span><span>₹{template.priceInr}</span><span className={`admin-status ${template.status}`}>{template.status}</span><div className="admin-actions"><button onClick={() => setEditor({ ...template })}>Edit</button><button onClick={() => duplicate(template)}>Copy</button><button onClick={() => updateStatus(template, template.status === "archived" ? "draft" : "archived")}>{template.status === "archived" ? "Restore" : "Archive"}</button><button onClick={() => remove(template.id)}>Delete</button></div></div>)}{!templates.length && <p className="admin-empty">No templates yet. Create the first one.</p>}</div>}
        <div className="admin-ops-grid"><section className="admin-ops-card"><h2>Orders &amp; renders</h2>{orders.slice(0, 8).map((order) => <p key={order.id}><strong>{order.templateTitle}</strong><span>₹{order.totalInr} · {order.status}</span></p>)}{!orders.length && <small>No renders yet.</small>}</section><section className="admin-ops-card"><h2>Credit wallets</h2>{wallets.slice(0, 8).map((wallet) => <p key={wallet.id}><strong>{wallet.email || wallet.id}</strong><span>₹{wallet.creditBalance || 0} <button onClick={() => adjustWallet(wallet.id)}>Adjust</button></span></p>)}{!wallets.length && <small>No customer wallets yet.</small>}</section><section className="admin-ops-card"><h2>Provider &amp; cleanup</h2><p>Higgsfield: <strong>{providerStatus?.higgsfield ? "configured" : "not configured"}</strong></p><p>Payments: <strong>{providerStatus?.payments ? "webhook ready" : "configure webhook secret"}</strong></p><p>Cleanup: <strong>cron endpoint ready</strong></p></section><section className="admin-ops-card"><h2>Ad intelligence <button onClick={syncAds}>Sync</button></h2>{scoutedAds.slice(0, 6).map((ad) => <p key={ad.id}><strong>{ad.headline}</strong><span>{ad.voteCount || 0} votes · {ad.approvedForPublic ? "public" : "admin only"} <button onClick={() => toggleScoutedApproval(ad)}>{ad.approvedForPublic ? "Hide" : "Approve"}</button></span></p>)}{!scoutedAds.length && <small>Sync to add an intelligence item.</small>}</section></div></section>
    </main>{editor && <TemplateEditor value={editor} onChange={setEditor} onClose={() => setEditor(null)} onSave={save} />}
  </div>;
}

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  async function checkAdmin() {
    try { const result = await apiFetch("/api/admin/me"); setUser(result.user); setError(""); }
    catch (err) { setUser(null); if (!String(err.message).includes("401")) setError(err.message); }
    finally { setChecking(false); }
  }
  useEffect(() => { checkAdmin(); }, []);
  if (checking) return <main className="admin-login"><p className="admin-muted">Checking Firebase access…</p></main>;
  if (!user) return <><Login onLogin={checkAdmin} />{error && <div className="admin-error" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)" }}>{error}</div>}</>;
  return <Dashboard user={user} onLogout={async () => { if (auth) await signOut(auth); setUser(null); }} />;
}
