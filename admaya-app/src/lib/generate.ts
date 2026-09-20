// The trust boundary for POST /api/generate, kept pure so it can be tested without a database.
//
// Rule: a customer may only supply values for variables flagged `editable`. Anything else in the
// request body (locked variables, unknown keys) is dropped, and the locked variable's stored
// default is used instead.

import type { PublicVariable } from "./types";

export const MAX_TEXT_LENGTH = 500;
export const MAX_TEXTAREA_LENGTH = 4000;

export type ResolveResult =
  | { ok: true; values: Record<string, string>; ignoredKeys: string[] }
  | { ok: false; error: string };

type ResolvableVariable = Pick<PublicVariable, "key" | "label" | "type" | "options" | "defaultValue" | "editable">;

export function resolveValues(
  variables: readonly ResolvableVariable[],
  submitted: Readonly<Record<string, string>>,
): ResolveResult {
  const submittedEntries = new Map(Object.entries(submitted));
  const values: Record<string, string> = {};

  for (const v of variables) {
    if (!v.editable || !submittedEntries.has(v.key)) {
      values[v.key] = v.defaultValue; // locked, or editable but left untouched
      continue;
    }
    const value = submittedEntries.get(v.key) as string;
    if (v.type === "select") {
      if (!v.options.includes(value)) return { ok: false, error: `"${value.slice(0, 60)}" is not a valid choice for ${v.label}.` };
    } else {
      const max = v.type === "textarea" ? MAX_TEXTAREA_LENGTH : MAX_TEXT_LENGTH;
      if (value.length > max) return { ok: false, error: `${v.label} is too long (max ${max} characters).` };
    }
    values[v.key] = value;
  }

  const editableKeys = new Set(variables.filter((v) => v.editable).map((v) => v.key));
  const ignoredKeys = [...submittedEntries.keys()].filter((k) => !editableKeys.has(k));
  return { ok: true, values, ignoredKeys };
}
