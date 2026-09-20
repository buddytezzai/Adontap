"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AdminTemplate, TemplateInput, TemplateStatus } from "@/lib/types";

// Client-side view of the templates in Postgres. Every mutation goes to /api/admin/* first and the
// state is updated from the server's response — this component never invents data.

export type EditorSeed = TemplateInput & { id?: string };
export interface EditorState {
  nonce: number;
  isNew: boolean;
  prefilled: boolean;
  initial: EditorSeed;
}

interface Ctx {
  templates: AdminTemplate[];
  toast: (msg: string) => void;
  toastMsg: string;
  toastShow: boolean;
  editor: EditorState | null;
  editorOpen: boolean;
  openEditor: (id: string | null, prefill?: Partial<TemplateInput>) => void;
  closeEditor: () => void;
  saveTemplate: (input: TemplateInput, id?: string) => Promise<AdminTemplate>;
  setStatus: (id: string, status: TemplateStatus) => Promise<AdminTemplate>;
  duplicate: (id: string) => Promise<AdminTemplate>;
  remove: (id: string) => Promise<void>;
}

const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => {
  const c = useContext(AdminCtx);
  if (!c) throw new Error("useAdmin outside AdminProvider");
  return c;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("Your session expired — signing you out.");
  }
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const ICONS = ["📦", "✨", "📱", "🎤", "⭐", "⚡", "⏱️", "🎙️", "🛍️", "🎬", "💬", "🏷️"];

export function defaultVars(): TemplateInput["variables"] {
  return [
    { key: "script", label: "Script", type: "textarea", options: [], defaultValue: "Write your ad script here…", editable: true },
    { key: "environment", label: "Environment", type: "select", options: ["Studio — white cyclorama", "Outdoor — urban street", "Home — living room", "Retail shelf close-up"], defaultValue: "Studio — white cyclorama", editable: false },
    { key: "avatarGender", label: "Avatar", type: "select", options: ["Female", "Male", "Non-binary / neutral"], defaultValue: "Female", editable: false },
    { key: "camera", label: "Camera movement", type: "select", options: ["Static lock-off", "Slow push-in", "Handheld follow", "Pan left-to-right"], defaultValue: "Slow push-in", editable: false },
    { key: "pacing", label: "Pacing", type: "select", options: ["Fast-cut (TikTok style)", "Steady / calm", "Punchy with beat drops"], defaultValue: "Fast-cut (TikTok style)", editable: false },
    { key: "style", label: "Visual style", type: "select", options: ["Bright & commercial", "Cinematic", "Moody & premium"], defaultValue: "Bright & commercial", editable: false },
  ];
}

export function blankTemplate(): EditorSeed {
  return {
    title: "", category: "", icon: "📦", colorFrom: "#eaa23a", colorTo: "#e15b64",
    durationSeconds: 15, priceInr: 150, costInr: 100, gstRate: 0.18, engine: "Seedance",
    status: "draft", basePrompt: "", variables: defaultVars(),
  };
}

export default function AdminProvider({ initialTemplates, children }: { initialTemplates: AdminTemplate[]; children: React.ReactNode }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nonce = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastShow(false), 2600);
  }, []);

  const upsert = (t: AdminTemplate) =>
    setTemplates((prev) => (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t]));

  const openEditor: Ctx["openEditor"] = (id, prefill) => {
    const existing = id ? templates.find((t) => t.id === id) : undefined;
    const initial: EditorSeed = existing
      ? structuredClone({ ...existing })
      : { ...blankTemplate(), ...prefill };
    setEditor({ nonce: ++nonce.current, isNew: !existing, prefilled: !!prefill && !existing, initial });
    setEditorOpen(true);
  };

  const value: Ctx = {
    templates, toast, toastMsg, toastShow, editor, editorOpen, openEditor,
    closeEditor: () => setEditorOpen(false),
    async saveTemplate(input, id) {
      const { template } = await api<{ template: AdminTemplate }>(id ? `/api/admin/templates/${id}` : "/api/admin/templates", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(input),
      });
      upsert(template);
      return template;
    },
    async setStatus(id, status) {
      const { template } = await api<{ template: AdminTemplate }>(`/api/admin/templates/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      upsert(template);
      return template;
    },
    async duplicate(id) {
      const { template } = await api<{ template: AdminTemplate }>(`/api/admin/templates/${id}/duplicate`, { method: "POST" });
      upsert(template);
      return template;
    },
    async remove(id) {
      await api(`/api/admin/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
  };

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}
