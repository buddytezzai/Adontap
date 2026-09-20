"use client";

import { useState } from "react";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Sign-in failed.");
        setBusy(false);
        return;
      }
      window.location.href = "/admin"; // full load so the server layout sees the new cookie
    } catch {
      setError("Couldn't reach the server.");
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={onSubmit}>
      <div className="brand">
        <div className="brand-mark">Am</div>
        <div>
          <div className="brand-name">
            Ad<em>Maya</em>.ai
          </div>
          <div className="brand-sub">Team Dashboard</div>
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="login-error" role="alert">{error}</div>
      <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
