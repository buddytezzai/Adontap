"use client";

import { useRef, useState } from "react";
import { gstFor, marginPct, totalWithGst } from "@/lib/pricing";
import { splitPrompt } from "@/lib/prompt";
import {
  ENGINES,
  ENGINE_LABEL,
  engineSupportsImage,
  inr,
  slugify,
  type Engine,
  type TemplateInput,
  type TemplateStatus,
  type VariableDTO,
  type VariableType,
} from "@/lib/types";
import { firstIssue, templateInputSchema } from "@/lib/validation";
import { ICONS, useAdmin, type EditorState } from "./AdminProvider";

// Ported from the drawer in admin_dashboard_3.html. The prototype kept a mutable `draft` object and
// re-rendered pieces of DOM by hand; here `draft` is React state, and Save writes to Postgres via
// /api/admin/templates instead of a local array.

type DraftVar = VariableDTO & { rid: string; optionsText: string };
interface Draft extends Omit<TemplateInput, "variables" | "durationSeconds" | "costInr" | "priceInr"> {
  id?: string;
  variables: DraftVar[];
  // Kept as strings while typing so a field can be cleared and retyped.
  dur: string;
  cost: string;
  price: string;
}

let ridSeq = 0;
const newRid = () => `v${++ridSeq}`;

function toDraft(e: EditorState): Draft {
  const s = e.initial;
  return {
    id: s.id,
    title: s.title,
    category: s.category,
    icon: s.icon,
    colorFrom: s.colorFrom,
    colorTo: s.colorTo,
    engine: s.engine,
    gstRate: s.gstRate,
    status: s.status,
    basePrompt: s.basePrompt,
    inspiredByScoutedAdId: s.inspiredByScoutedAdId,
    dur: String(s.durationSeconds),
    cost: String(s.costInr),
    price: String(s.priceInr),
    variables: s.variables.map((v) => ({ ...v, rid: newRid(), optionsText: v.options.join(", ") })),
  };
}

function toInput(d: Draft, status: TemplateStatus): TemplateInput {
  return {
    title: d.title,
    category: d.category,
    icon: d.icon,
    colorFrom: d.colorFrom,
    colorTo: d.colorTo,
    durationSeconds: Math.round(Number(d.dur)) || 0,
    costInr: Math.round(Number(d.cost)) || 0,
    priceInr: Math.round(Number(d.price)) || 0,
    gstRate: d.gstRate,
    engine: d.engine,
    status,
    basePrompt: d.basePrompt,
    inspiredByScoutedAdId: d.inspiredByScoutedAdId,
    variables: d.variables.map((v) => ({
      key: v.key,
      label: v.label,
      type: v.type,
      options: v.type === "select" ? v.options : [],
      defaultValue: v.defaultValue,
      editable: v.editable,
    })),
  };
}

function EditorForm({ editor }: { editor: EditorState }) {
  const { saveTemplate, remove, closeEditor, toast } = useAdmin();
  const [draft, setDraft] = useState<Draft>(() => toDraft(editor));
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [heading] = useState(
    editor.isNew
      ? editor.prefilled
        ? "New Template — from Ad Intelligence"
        : "New Template"
      : "Edit — " + editor.initial.title,
  );

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const patchVar = (rid: string, fn: (v: DraftVar) => DraftVar) =>
    setDraft((d) => ({ ...d, variables: d.variables.map((v) => (v.rid === rid ? fn(v) : v)) }));

  const cost = Number(draft.cost) || 0;
  const price = Number(draft.price) || 0;

  // ───── variable row edits ─────
  const setLabel = (rid: string, label: string) =>
    patchVar(rid, (v) => ({ ...v, label, key: slugify(label) || v.key }));
  const setType = (rid: string, type: VariableType) =>
    patchVar(rid, (v) => {
      let { options, optionsText, defaultValue } = v;
      if (type === "select") {
        if (!options.length) {
          options = ["Option A", "Option B"];
          optionsText = options.join(", ");
        }
        if (!options.includes(defaultValue)) defaultValue = options[0];
      } else if (type === "image") {
        defaultValue = "/samples/product-sample.jpg";
      }
      return { ...v, type, options, optionsText, defaultValue };
    });
  const setOptions = (rid: string, text: string) =>
    patchVar(rid, (v) => {
      const options = text.split(",").map((s) => s.trim()).filter(Boolean);
      // A dropdown's default must stay one of its options.
      const defaultValue = v.type === "select" && !options.includes(v.defaultValue) ? options[0] ?? "" : v.defaultValue;
      return { ...v, optionsText: text, options, defaultValue };
    });
  const addVar = () =>
    setDraft((d) => ({
      ...d,
      variables: [
        ...d.variables,
        {
          rid: newRid(),
          key: `var_${Math.random().toString(36).slice(2, 9)}`,
          label: "New variable",
          type: "text",
          options: [],
          optionsText: "",
          defaultValue: "",
          editable: false,
        },
      ],
    }));
  const removeVar = (rid: string) =>
    setDraft((d) => ({ ...d, variables: d.variables.filter((v) => v.rid !== rid) }));

  // ───── save / delete ─────
  async function save(status: TemplateStatus) {
    const parsed = templateInputSchema.safeParse(toInput(draft, status));
    if (!parsed.success) {
      toast(firstIssue(parsed.error));
      if (!draft.title.trim()) titleRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const saved = await saveTemplate(parsed.data, draft.id);
      closeEditor();
      toast(
        status === "published"
          ? `"${saved.title}" is now live on the template gallery.`
          : `"${saved.title}" saved as draft.`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save the template.");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!draft.id) return;
    if (!window.confirm(`Delete "${draft.title}" permanently? This also removes it from the public gallery.`)) return;
    setBusy(true);
    try {
      await remove(draft.id);
      closeEditor();
      toast("Template deleted.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete the template.");
    } finally {
      setBusy(false);
    }
  }

  // ───── derived: live assembled prompt + Studio simulation ─────
  const byKey = new Map(draft.variables.map((v) => [v.key, v]));
  const promptParts = draft.basePrompt ? splitPrompt(draft.basePrompt) : null;
  const locked = draft.variables.filter((v) => !v.editable);
  const editable = draft.variables.filter((v) => v.editable);
  const hasImageVar = draft.variables.some((v) => v.type === "image");
  const engineImageSupported = engineSupportsImage(draft.engine);

  return (
    <>
      <div className="drawer-head">
        <div>
          <h3 id="drawerTitle">{heading}</h3>
          <div className="sub" id="drawerSub">
            {editor.isNew ? "Draft — not visible on the site yet" : "Editing a live library entry"}
          </div>
        </div>
        <button className="drawer-close" id="drawerCloseBtn" onClick={closeEditor} aria-label="Close editor">
          ✕
        </button>
      </div>

      <div className="drawer-body">
        {/* LEFT: basics + economics */}
        <div className="field-group">
          <div className="section-title">Basics</div>
          <div className="section-desc">What the customer sees on the template card, and what it costs you to render.</div>

          <div className="field">
            <label>Template name</label>
            <input
              type="text"
              id="f_title"
              ref={titleRef}
              placeholder="e.g. Unbox & React"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>Category</label>
              <input
                type="text"
                id="f_cat"
                placeholder="e.g. E-commerce · UGC Unboxing"
                value={draft.category}
                onChange={(e) => patch({ category: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Duration (seconds)</label>
              <input
                type="number"
                id="f_dur"
                min={4}
                max={60}
                value={draft.dur}
                onChange={(e) => patch({ dur: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>Card icon</label>
            <div className="icon-picker" id="iconPicker">
              {ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  data-icon={ic}
                  className={ic === draft.icon ? "sel" : ""}
                  onClick={() => patch({ icon: ic })}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>AI engine</label>
            <select
              id="f_engine"
              value={draft.engine}
              onChange={(e) => patch({ engine: e.target.value as Engine })}
            >
              {ENGINES.map((en) => (
                <option key={en} value={en}>
                  {ENGINE_LABEL[en]} {engineSupportsImage(en) ? "🖼️ (supports image upload)" : ""}
                </option>
              ))}
            </select>
            <div className="hint">
              Which provider adapter renders this template — see the integration playbook for how each one plugs in.
            </div>
            {hasImageVar && !engineImageSupported && (
              <div className="alert-warning">
                ⚠️ <b>Engine Limitation:</b> {ENGINE_LABEL[draft.engine]} does not support image-conditioned generation. Switch to Higgsfield, Runway, or Seedance to use image upload variables.
              </div>
            )}
          </div>

          <fieldset>
            <legend>Unit economics</legend>
            <div className="row2">
              <div className="field">
                <label>Your cost (₹)</label>
                <input
                  type="number"
                  id="f_cost"
                  min={1}
                  value={draft.cost}
                  onChange={(e) => patch({ cost: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Sell price (₹, before GST)</label>
                <input
                  type="number"
                  id="f_price"
                  min={1}
                  value={draft.price}
                  onChange={(e) => patch({ price: e.target.value })}
                />
              </div>
            </div>
            <div className="econ-out" id="econOut">
              <div className="item">
                Margin<b>{marginPct(price, cost)}%</b>
              </div>
              <div className="item">
                Profit / video<b>{inr(price - cost)}</b>
              </div>
              <div className="item">
                +GST ({Math.round(draft.gstRate * 100)}%)<b>{inr(gstFor(price, draft.gstRate))}</b>
              </div>
              <div className="item">
                Customer pays<b>{inr(totalWithGst(price, draft.gstRate))}</b>
              </div>
            </div>
          </fieldset>

          <div className="field">
            <label>Status</label>
            <select
              id="f_status"
              value={draft.status}
              onChange={(e) => patch({ status: e.target.value as TemplateStatus })}
            >
              <option value="draft">Draft — hidden from site</option>
              <option value="published">Published — live on gallery</option>
              <option value="archived">Archived — pulled from gallery</option>
            </select>
          </div>
        </div>

        {/* RIGHT: prompt + variables + live preview */}
        <div className="field-group">
          <div className="section-title">Base prompt</div>
          <div className="section-desc">
            The full generation prompt sent to the engine. Use <code>{"{{variableKey}}"}</code> anywhere you want a
            variable&apos;s value inserted — build the variables below.
          </div>
          <div className="field">
            <textarea
              id="f_baseprompt"
              rows={6}
              placeholder="e.g. A {{avatarGender}} creator films a {{style}} unboxing video with {{productImage}} in a {{environment}}, camera does a {{camera}}. They say: {{script}}"
              value={draft.basePrompt}
              onChange={(e) => patch({ basePrompt: e.target.value })}
            />
          </div>

          <div className="section-title" style={{ marginTop: 6 }}>
            Prompt variables
          </div>
          <div className="section-desc">
            Add every variable your prompt uses. Tick &quot;customer can edit&quot; only for the ones you want the final
            user changing on the Studio page — everything else stays locked to your default.
          </div>
          <div className="var-list" id="varList">
            {draft.variables.length === 0 && <div className="hint">No variables yet — add one below.</div>}
            {draft.variables.map((v) => {
              const isSelect = v.type === "select";
              const isImage = v.type === "image";
              const referenced = draft.basePrompt.includes("{{" + v.key + "}}");
              return (
                <div className="var-row" key={v.rid} data-key={v.key}>
                  <div className="var-row-top">
                    <div className="field">
                      <label>Label</label>
                      <input
                        type="text"
                        data-f="label"
                        value={v.label}
                        placeholder="e.g. Product Image"
                        onChange={(e) => setLabel(v.rid, e.target.value)}
                      />
                      <div className="var-key-preview">
                        key: <code>{`{{${v.key}}}`}</code>
                      </div>
                    </div>
                    <div className="field">
                      <label>Type</label>
                      <select
                        data-f="type"
                        value={v.type}
                        onChange={(e) => setType(v.rid, e.target.value as VariableType)}
                      >
                        <option value="text">Short text</option>
                        <option value="textarea">Long text (script)</option>
                        <option value="select">Dropdown</option>
                        <option value="image">Image Upload</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Default value / sample</label>
                      {isSelect ? (
                        <select
                          data-f="value"
                          value={v.defaultValue}
                          onChange={(e) =>
                            patchVar(v.rid, (x) => ({ ...x, defaultValue: e.target.value }))
                          }
                        >
                          {v.options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          data-f="value"
                          placeholder={isImage ? "Sample image URL" : "Default text value"}
                          value={v.defaultValue}
                          onChange={(e) =>
                            patchVar(v.rid, (x) => ({ ...x, defaultValue: e.target.value }))
                          }
                        />
                      )}
                    </div>
                    <button
                      className="var-remove"
                      type="button"
                      data-action="remove-var"
                      title="Remove variable"
                      onClick={() => removeVar(v.rid)}
                    >
                      🗑
                    </button>
                  </div>
                  {isSelect && (
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>Dropdown options (comma-separated)</label>
                      <input
                        type="text"
                        data-f="options"
                        value={v.optionsText}
                        onChange={(e) => setOptions(v.rid, e.target.value)}
                      />
                    </div>
                  )}
                  {isImage && (
                    <div className="hint" style={{ marginTop: 4, color: "var(--peacock)" }}>
                      📷 Customer will see an 8MB image uploader in Studio.
                    </div>
                  )}
                  <div className="var-row-bottom">
                    <div className="hint" style={{ alignSelf: "center" }}>
                      {referenced ? "✓ referenced in base prompt" : "⚠️ key not used in base prompt"}
                    </div>
                    <label className="editable-check">
                      <input
                        type="checkbox"
                        data-f="editable"
                        checked={v.editable}
                        onChange={(e) =>
                          patchVar(v.rid, (x) => ({ ...x, editable: e.target.checked }))
                        }
                      />
                      <span>Customer can edit in Studio</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="add-var-btn" type="button" id="addVarBtn" onClick={addVar}>
            + Add variable
          </button>

          {/* Derived live preview */}
          <div className="live-preview" id="livePreview">
            <div className="section-title">Live assembled prompt (server-side output)</div>
            <div className="section-desc">
              How the final prompt will look when sent to {ENGINE_LABEL[draft.engine]} with the defaults above.
            </div>
            <div className="preview-bubble" id="previewBubble">
              {promptParts?.map((p, i) =>
                p.type === "text" ? (
                  <span key={i}>{p.text}</span>
                ) : byKey.has(p.key) ? (
                  <span className="token-resolved" key={i} title={`{{${p.key}}}`}>
                    {byKey.get(p.key)!.defaultValue || `[${p.key}]`}
                  </span>
                ) : (
                  <span className="token-missing" key={i} title="Missing variable definition">
                    {`{{${p.key}}}`}
                  </span>
                ),
              )}
            </div>

            <div className="section-title" style={{ marginTop: 16 }}>
              Studio simulation (what the customer sees)
            </div>
            <div className="sim-panel" id="simPanel">
              <div className="sim-col">
                <div className="sim-head">
                  🔒 Locked ({locked.length})<span className="hint">Set by you above</span>
                </div>
                {locked.length === 0 && <div className="hint">No locked variables.</div>}
                {locked.map((v) => (
                  <div className="sim-row" key={v.rid}>
                    <div className="k">{v.label}</div>
                    <div className="v">{v.defaultValue || "—"}</div>
                  </div>
                ))}
              </div>
              <div className="sim-col">
                <div className="sim-head">
                  ✏️ Customer editable ({editable.length})
                  <span className="hint">Rendered as inputs in the Studio</span>
                </div>
                {editable.length === 0 && <div className="hint">No editable variables.</div>}
                {editable.map((v) => (
                  <div className="sim-row" key={v.rid}>
                    <div className="k">{v.label}</div>
                    <div className="v editable-tag">
                      {v.type === "image" ? "📷 Image Uploader" : v.type === "textarea" ? "Long text" : v.type === "select" ? "Dropdown" : "Short text"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="drawer-foot">
        <div>
          {draft.id && (
            <button className="btn btn-danger-ghost" type="button" id="deleteBtn" disabled={busy} onClick={del}>
              Delete template
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
          <button className="btn btn-ghost" type="button" id="saveDraftBtn" disabled={busy} onClick={() => save("draft")}>
            Save as draft
          </button>
          <button className="btn btn-primary" type="button" id="publishBtn" disabled={busy} onClick={() => save("published")}>
            Publish to gallery →
          </button>
        </div>
      </div>
    </>
  );
}

export default function EditorDrawer() {
  const { editor, editorOpen, closeEditor } = useAdmin();
  return (
    <>
      <div className={"overlay" + (editorOpen ? " open" : "")} id="overlay" onClick={closeEditor}></div>
      <div className={"drawer" + (editorOpen ? " open" : "")} id="drawer" aria-label="Template editor" inert={!editorOpen}>
        {/* keyed by `nonce`: every open starts from a fresh draft; the last one stays mounted while the drawer slides out */}
        {editor && <EditorForm key={editor.nonce} editor={editor} />}
      </div>
    </>
  );
}
