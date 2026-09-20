// Client-safe shared types & constants. Nothing in here may import Prisma or server-only code.

export const ENGINES = ["Seedance", "Higgsfield", "HeyGen", "Runway", "GoogleVeo"] as const;
export type Engine = (typeof ENGINES)[number];
export const ENGINE_LABEL: Record<Engine, string> = {
  Seedance: "Seedance",
  Higgsfield: "Higgsfield",
  HeyGen: "HeyGen",
  Runway: "Runway",
  GoogleVeo: "Google Veo",
};

export const STATUSES = ["draft", "published", "archived"] as const;
export type TemplateStatus = (typeof STATUSES)[number];

export const VARIABLE_TYPES = ["text", "textarea", "select"] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

export interface VariableDTO {
  key: string;
  label: string;
  type: VariableType;
  options: string[];
  defaultValue: string;
  editable: boolean;
}

/** Everything the team can write from /admin. */
export interface TemplateInput {
  title: string;
  category: string;
  icon: string;
  colorFrom: string;
  colorTo: string;
  durationSeconds: number;
  engine: Engine;
  costInr: number;
  priceInr: number;
  gstRate: number;
  status: TemplateStatus;
  basePrompt: string;
  variables: VariableDTO[];
}

/** Full record as seen from /admin (includes cost + base prompt). Never sent to the public site. */
export interface AdminTemplate extends TemplateInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** The public projection: no costInr, no basePrompt, ever. */
export interface PublicVariable {
  key: string;
  label: string;
  type: VariableType;
  options: string[];
  defaultValue: string;
  editable: boolean;
}

export interface PublicTemplate {
  id: string;
  title: string;
  category: string;
  icon: string;
  colorFrom: string;
  colorTo: string;
  durationSeconds: number;
  engine: Engine;
  priceInr: number;
  gstRate: number;
  variables: PublicVariable[];
}

export interface GenerateResult {
  generationId: string;
  status: "complete";
  title: string;
  durationSeconds: number;
  engine: Engine;
  priceInr: number;
  gstInr: number;
  totalInr: number;
}

export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+(.)/g, (_m, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

export function inr(n: number): string {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
