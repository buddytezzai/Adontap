"use client";

import { useState } from "react";
import { inr } from "@/lib/types";
import { marginPct } from "@/lib/pricing";
import { ENGINE_LABEL, type TemplateStatus } from "@/lib/types";
import { useAdmin } from "./AdminProvider";
import Stats from "./Stats";

const STATUS_ORDER: TemplateStatus[] = ["draft", "published", "archived"];

export default function TemplatesView() {
  const { templates, openEditor, setStatus, duplicate, toast } = useAdmin();
  const [search, setSearch] = useState("");

  const filter = search.toLowerCase();
  const rows = templates.filter(
    (t) => !filter || t.title.toLowerCase().includes(filter) || t.category.toLowerCase().includes(filter) || ENGINE_LABEL[t.engine].toLowerCase().includes(filter),
  );

  const run = async (fn: () => Promise<string>) => {
    try {
      toast(await fn());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const cycleStatus = (id: string) =>
    run(async () => {
      const t = templates.find((x) => x.id === id)!;
      const next = STATUS_ORDER[(STATUS_ORDER.indexOf(t.status) + 1) % STATUS_ORDER.length];
      await setStatus(id, next);
      return `"${t.title}" is now ${next}.`;
    });

  const archive = (id: string) =>
    run(async () => {
      const t = templates.find((x) => x.id === id)!;
      const next: TemplateStatus = t.status === "archived" ? "draft" : "archived";
      await setStatus(id, next);
      return next === "archived" ? `"${t.title}" archived and pulled from the gallery.` : `"${t.title}" restored to draft.`;
    });

  const dup = (id: string) => run(async () => `Duplicated as "${(await duplicate(id)).title}".`);

  return (
    <div className="view active" id="view-templates">
      <div className="topbar">
        <div>
          <h2>Templates</h2>
          <div className="sub">What&apos;s live in the gallery on admaya.ai, and what&apos;s still in draft</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="search-box">
            <span>🔎</span>
            <input type="text" id="searchInput" placeholder="Search templates or category…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" id="addTemplateBtn" onClick={() => openEditor(null)}>
            ＋ New Template
          </button>
        </div>
      </div>

      <div className="content">
        <div className="banner">
          <span>ℹ️</span>
          <div>
            <b>How this connects to the front end:</b> anything marked <b>Published</b> below appears immediately as a card in the template gallery on admaya.ai. Only the variables you flag &quot;customer can edit&quot; show up as fields in the customer&apos;s Studio — everything else stays locked exactly as you set it here.
          </div>
        </div>

        <Stats id="statsRow" />

        <div className="panel">
          <div className="panel-head">
            <h3>Template Library</h3>
            <span className="sub" id="listCount" style={{ fontSize: ".78rem", color: "var(--ink-faint)" }}>
              {rows.length} of {templates.length} shown
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Template</th>
                <th>Engine</th>
                <th>Duration</th>
                <th>Price / Margin</th>
                <th>Customer-editable fields</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="templateTbody">
              {rows.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={7}>{filter ? `No templates match "${search}".` : "No templates yet — create your first one."}</td>
                </tr>
              )}
              {rows.map((t) => {
                const editableVars = t.variables.filter((v) => v.editable);
                return (
                  <tr key={t.id} data-id={t.id}>
                    <td>
                      <div className="tmpl-cell">
                        <div className="tmpl-thumb" style={{ background: `linear-gradient(155deg, ${t.colorFrom}, ${t.colorTo})` }}>{t.icon}</div>
                        <div>
                          <div className="name">{t.title}</div>
                          <div className="cat">{t.category}</div>
                        </div>
                      </div>
                    </td>
                    <td>{ENGINE_LABEL[t.engine]}</td>
                    <td>{t.durationSeconds}s</td>
                    <td className="price-cell">
                      <b>{inr(t.priceInr)}</b>
                      <div className="margin">
                        cost {inr(t.costInr)} · {marginPct(t.priceInr, t.costInr)}% margin
                      </div>
                    </td>
                    <td>
                      <div className="tag-row">
                        {editableVars.length ? (
                          editableVars.map((v) => (
                            <span className="tag editable" key={v.key}>{v.label}</span>
                          ))
                        ) : (
                          <span className="tag">— none (fully locked)</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button className={`status-pill ${t.status}`} data-action="cycle-status" onClick={() => cycleStatus(t.id)}>
                        {t.status}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="Edit" data-action="edit" onClick={() => openEditor(t.id)}>✎</button>
                        <button className="icon-btn" title="Duplicate" data-action="duplicate" onClick={() => dup(t.id)}>⧉</button>
                        <button className="icon-btn" title="Archive" data-action="archive" onClick={() => archive(t.id)}>🗄</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
