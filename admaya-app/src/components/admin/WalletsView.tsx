"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WalletRow } from "@/lib/admin-ops";
import { inr } from "@/lib/types";
import { useAdmin } from "./AdminProvider";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

function AdjustRow({ row, onDone }: { row: WalletRow; onDone: () => void }) {
  const { toast } = useAdmin();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(sign: 1 | -1) {
    const n = Math.round(Number(amount));
    if (!n || n < 0) return toast("Enter a positive whole number of credits.");
    if (reason.trim().length < 3) return toast("Add a short reason — it is saved in the audit log.");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/wallets/${row.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: sign * n, reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't adjust credits");
      toast(`${sign > 0 ? "Added" : "Removed"} ${inr(n)} · ${row.email} now has ${inr(body.creditBalance)}.`);
      onDone();
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't adjust credits");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td colSpan={6} style={{ background: "var(--surface-2)" }}>
        <div className="inline-form">
          <input type="number" min={1} placeholder="Credits (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 130 }} aria-label="Credits" />
          <input type="text" placeholder="Reason (saved in audit log)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1, minWidth: 200 }} aria-label="Reason" />
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => submit(1)}>＋ Add</button>
          <button className="btn btn-danger-ghost btn-sm" disabled={busy} onClick={() => submit(-1)}>− Remove</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onDone}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

export default function WalletsView({ rows, totalCredits }: { rows: WalletRow[]; totalCredits: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const shown = rows.filter((r) => !q || r.email.toLowerCase().includes(q) || (r.name ?? "").toLowerCase().includes(q));

  return (
    <div className="view active" id="view-wallets">
      <div className="topbar">
        <div>
          <h2>Credit Wallets</h2>
          <div className="sub">Customer balances. Credits can&apos;t be bought yet, so grant them here — every change is logged</div>
        </div>
        <div className="search-box">
          <span>🔎</span>
          <input type="text" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="content">
        <div className="stats-row">
          <div className="stat-card"><div className="lbl">Customers</div><div className="val">{rows.length}</div></div>
          <div className="stat-card"><div className="lbl">Credits outstanding</div><div className="val">{inr(totalCredits)}</div><div className="delta warn">what you owe in renders</div></div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>Customers</h3>
            <span className="sub" style={{ fontSize: ".78rem", color: "var(--ink-faint)" }}>{shown.length} of {rows.length} shown</span>
          </div>
          <table>
            <thead><tr><th>Customer</th><th>Balance</th><th>Renders</th><th>Joined</th><th>Last adjustment</th><th></th></tr></thead>
            <tbody>
              {shown.length === 0 && (
                <tr className="empty-row"><td colSpan={6}>{rows.length ? "No customers match." : "No customers yet. Accounts appear here when someone signs up on the site."}</td></tr>
              )}
              {shown.flatMap((r) => [
                <tr key={r.id}>
                  <td><div className="name" style={{ fontWeight: 600 }}>{r.email}</div><div className="cat" style={{ fontSize: ".74rem", color: "var(--ink-faint)" }}>{r.name}</div></td>
                  <td className="price-cell"><b>{inr(r.creditBalance)}</b></td>
                  <td>{r.renders}</td>
                  <td>{when(r.joinedAt)}</td>
                  <td style={{ fontSize: ".78rem", color: "var(--ink-dim)" }}>
                    {r.lastAdjustment ? <>{r.lastAdjustment.amount > 0 ? "+" : "−"}{inr(Math.abs(r.lastAdjustment.amount))} · {r.lastAdjustment.reason}<div style={{ color: "var(--ink-faint)" }}>{r.lastAdjustment.by}, {when(r.lastAdjustment.at)}</div></> : "—"}
                  </td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === r.id ? null : r.id)}>Adjust credits</button></td>
                </tr>,
                ...(open === r.id ? [<AdjustRow key={r.id + "-adjust"} row={r} onDone={() => setOpen(null)} />] : []),
              ])}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
