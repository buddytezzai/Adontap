"use client";

import { useState } from "react";
import { useAdmin } from "./AdminProvider";

export default function AccountView({ email }: { email: string }) {
  const { toast } = useAdmin();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) return toast("The new passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't change the password");
      toast("Password changed. Use it next time you sign in.");
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't change the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="view active" id="view-account">
      <div className="topbar">
        <div>
          <h2>Account</h2>
          <div className="sub">Your admin login</div>
        </div>
      </div>
      <div className="content">
        <div className="panel" style={{ padding: 22, maxWidth: 520 }}>
          <div className="section-title">Signed in as</div>
          <div className="section-desc" style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{email}</div>

          <form className="field-group" onSubmit={submit}>
            <div className="section-title" style={{ marginTop: 8 }}>Change password</div>
            <div className="field">
              <label htmlFor="pw_cur">Current password</label>
              <input id="pw_cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="pw_new">New password</label>
              <input id="pw_new" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required />
              <div className="hint">At least 10 characters.</div>
            </div>
            <div className="field">
              <label htmlFor="pw_again">Repeat new password</label>
              <input id="pw_again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ alignSelf: "flex-start" }}>{busy ? "Saving…" : "Change password"}</button>
          </form>

          <div className="hint" style={{ marginTop: 22, color: "var(--ink-faint)" }}>
            Need another admin, or locked out? From the <code>admaya-app</code> folder run <code>npm run admin:set -- someone@example.com &quot;a-long-password&quot;</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
