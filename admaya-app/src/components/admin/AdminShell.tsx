"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminTemplate } from "@/lib/types";
import AdminProvider, { useAdmin } from "./AdminProvider";
import EditorDrawer from "./EditorDrawer";

function Sidebar() {
  const pathname = usePathname();
  const { templates, openEditor } = useAdmin();
  const item = (href: string, ic: string, label: string, badge?: React.ReactNode) => (
    <Link href={href} className={"nav-item" + (pathname === href ? " active" : "")}>
      <span className="ic">{ic}</span> {label} {badge}
    </Link>
  );

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">Am</div>
        <div>
          <div className="brand-name">
            Ad<em>Maya</em>.ai
          </div>
          <div className="brand-sub">Team Dashboard</div>
        </div>
      </div>

      <div className="nav-group">
        <div className="nav-label">Templates</div>
        {item("/admin", "▦", "All Templates", <span className="nav-badge" id="navCount">{templates.length}</span>)}
        <button className="nav-item" id="navNewBtn" onClick={() => openEditor(null)}>
          <span className="ic">＋</span> New Template
        </button>
      </div>

      <div className="nav-group">
        <div className="nav-label">Insights</div>
        {item("/admin/ad-intelligence", "📡", "Ad Intelligence", <span className="nav-badge" style={{ background: "rgba(33,166,147,.18)", color: "var(--peacock)" }}>new</span>)}
      </div>

      <div className="nav-group">
        <div className="nav-label">Operations</div>
        {item("/admin/overview", "◐", "Overview")}
        {item("/admin/orders", "⎘", "Orders & Renders")}
        {item("/admin/wallets", "⛁", "Credit Wallets")}
        {item("/admin/provider-keys", "⚙", "Provider Keys")}
        {item("/admin/account", "👤", "Account")}
      </div>

      <div className="sidebar-foot">
        <div className="avatar-chip">BT</div>
        <div className="who">
          <b>Buddy Tezz Team</b>
          <span>admin · content ops</span>
        </div>
        <button className="signout-btn" onClick={signOut} title="Sign out" aria-label="Sign out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

function Toast() {
  const { toastMsg, toastShow } = useAdmin();
  return <div className={"toast" + (toastShow ? " show" : "")} id="toast">{toastMsg}</div>;
}

export default function AdminShell({ initialTemplates, children }: { initialTemplates: AdminTemplate[]; children: React.ReactNode }) {
  return (
    <AdminProvider initialTemplates={initialTemplates}>
      <div className="app">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
      <EditorDrawer />
      <Toast />
    </AdminProvider>
  );
}
