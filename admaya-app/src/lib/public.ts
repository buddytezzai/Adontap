// The ONLY place a database row becomes a public API object. It builds the result field by field
// (an allow-list), never by spreading the row, so a column added to the schema later cannot leak
// by accident. `costInr` and `basePrompt` are deliberately absent.

import type { Engine, PublicTemplate, PublicVariable, VariableType } from "./types";

interface RowVariable {
  key: string;
  label: string;
  type: VariableType;
  options: unknown;
  defaultValue: string;
  editable: boolean;
}

interface RowTemplate {
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
  variables: RowVariable[];
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

export function toPublicVariable(v: RowVariable): PublicVariable {
  return {
    key: v.key,
    label: v.label,
    type: v.type,
    options: toStringArray(v.options),
    defaultValue: v.defaultValue,
    editable: v.editable,
  };
}

export function toPublicTemplate(row: RowTemplate): PublicTemplate {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    icon: row.icon,
    colorFrom: row.colorFrom,
    colorTo: row.colorTo,
    durationSeconds: row.durationSeconds,
    engine: row.engine,
    priceInr: row.priceInr,
    gstRate: row.gstRate,
    variables: row.variables.map(toPublicVariable),
  };
}
