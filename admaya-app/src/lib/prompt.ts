// Prompt templating. `{{key}}` tokens in a base prompt are replaced in a SINGLE pass, so a value
// that itself contains `{{otherKey}}` is never expanded a second time.

const TOKEN = /\{\{(\w+)\}\}/g;

export type PromptPart = { type: "text"; text: string } | { type: "token"; key: string };

export function assemblePrompt(basePrompt: string, values: Readonly<Record<string, string>>): string {
  return basePrompt.replace(TOKEN, (whole, key: string) =>
    Object.hasOwn(values, key) ? values[key] : whole,
  );
}

/** Splits a base prompt into text and token parts (used by the admin live preview). */
export function splitPrompt(basePrompt: string): PromptPart[] {
  const parts: PromptPart[] = [];
  let last = 0;
  for (const m of basePrompt.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ type: "text", text: basePrompt.slice(last, at) });
    parts.push({ type: "token", key: m[1] });
    last = at + m[0].length;
  }
  if (last < basePrompt.length) parts.push({ type: "text", text: basePrompt.slice(last) });
  return parts;
}

/** `{{tokens}}` used in the prompt that no variable defines. */
export function unresolvedKeys(basePrompt: string, definedKeys: Iterable<string>): string[] {
  const defined = new Set(definedKeys);
  const missing = new Set<string>();
  for (const m of basePrompt.matchAll(TOKEN)) if (!defined.has(m[1])) missing.add(m[1]);
  return [...missing];
}
