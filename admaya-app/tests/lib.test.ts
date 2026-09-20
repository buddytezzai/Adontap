import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValues } from "../src/lib/generate";
import { assemblePrompt, splitPrompt, unresolvedKeys } from "../src/lib/prompt";
import { toPublicTemplate } from "../src/lib/public";
import { gstFor, marginPct, totalWithGst } from "../src/lib/pricing";
import { templateInputSchema } from "../src/lib/validation";
import type { TemplateInput, VariableDTO } from "../src/lib/types";

const vars: VariableDTO[] = [
  { key: "script", label: "Script", type: "textarea", options: [], defaultValue: "default script", editable: true },
  { key: "environment", label: "Environment", type: "select", options: ["Studio", "Street"], defaultValue: "Studio", editable: false },
  { key: "camera", label: "Camera", type: "select", options: ["Static", "Push-in"], defaultValue: "Static", editable: true },
];

const collectKeys = (o: unknown, acc: string[] = []): string[] => {
  if (Array.isArray(o)) o.forEach((x) => collectKeys(x, acc));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) (acc.push(k), collectKeys(v, acc));
  return acc;
};

test("public projection never contains costInr or basePrompt, even if the row has them", () => {
  const row = {
    id: "t1", title: "T", category: "C", icon: "📦", colorFrom: "#000000", colorTo: "#ffffff",
    durationSeconds: 15, engine: "Seedance" as const, priceInr: 149, gstRate: 0.18,
    costInr: 100, basePrompt: "secret {{script}}", status: "published", // extra columns a careless select could return
    variables: vars.map((v) => ({ ...v, id: "x", templateId: "t1", sortOrder: 0 })),
  };
  const out = toPublicTemplate(row);
  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes("costInr") && !serialized.includes("basePrompt") && !serialized.includes("secret"));
  assert.ok(!collectKeys(out).some((k) => ["costInr", "basePrompt", "status", "templateId", "sortOrder"].includes(k)));
  assert.deepEqual(Object.keys(out.variables[0]).sort(), ["defaultValue", "editable", "key", "label", "options", "type"]);
});

test("generate: a value submitted for a LOCKED variable is ignored; the stored default wins", () => {
  const r = resolveValues(vars, { script: "my script", environment: "Street", nonsense: "x" });
  assert.ok(r.ok);
  assert.equal(r.values.environment, "Studio");
  assert.equal(r.values.script, "my script");
  assert.equal(r.values.camera, "Static"); // editable but untouched -> default
  assert.deepEqual(r.ignoredKeys.sort(), ["environment", "nonsense"]);
});

test("generate: invalid select choice / oversize text on an editable variable is rejected", () => {
  assert.equal(resolveValues(vars, { camera: "Helicopter" }).ok, false);
  assert.equal(resolveValues(vars, { script: "x".repeat(4001) }).ok, false);
});

test("generate: __proto__ / constructor keys cannot smuggle anything in", () => {
  const evil = JSON.parse('{"__proto__": "x", "constructor": "y", "script": "ok"}');
  const r = resolveValues(vars, evil);
  assert.ok(r.ok);
  assert.equal(r.values.script, "ok");
  assert.equal(Object.getPrototypeOf(r.values), Object.prototype);
});

test("assemblePrompt substitutes once — a value containing {{token}} is not re-expanded", () => {
  const out = assemblePrompt("A {{camera}} in {{environment}}: {{script}}", {
    camera: "Static", environment: "Studio", script: "reveal {{environment}} and {{camera}}",
  });
  assert.equal(out, "A Static in Studio: reveal {{environment}} and {{camera}}");
  assert.equal(assemblePrompt("{{constructor}} {{missing}}", {}), "{{constructor}} {{missing}}");
  assert.equal(assemblePrompt("cost $& {{a}}", { a: "$&$1" }), "cost $& $&$1"); // no special replacement patterns
});

test("splitPrompt / unresolvedKeys", () => {
  assert.deepEqual(splitPrompt("a {{x}} b"), [{ type: "text", text: "a " }, { type: "token", key: "x" }, { type: "text", text: " b" }]);
  assert.deepEqual(unresolvedKeys("{{a}} {{b}} {{a}}", ["a"]), ["b"]);
});

test("pricing maths matches the admin prototype (margin, GST, customer pays)", () => {
  assert.equal(marginPct(149, 100), 33);
  assert.equal(gstFor(149, 0.18), 27);
  assert.equal(totalWithGst(149, 0.18), 176);
  assert.equal(marginPct(0, 10), 0);
});

const base = (over: Partial<TemplateInput> = {}): TemplateInput => ({
  title: "T", category: "C", icon: "📦", colorFrom: "#eaa23a", colorTo: "#e15b64", durationSeconds: 15, engine: "Seedance",
  costInr: 100, priceInr: 150, gstRate: 0.18, status: "draft", basePrompt: "{{script}}", variables: [vars[0]], ...over,
});

test("validation: duplicate keys, bad select default, and publishing with an unresolved token are rejected", () => {
  assert.ok(templateInputSchema.safeParse(base()).success);
  assert.ok(!templateInputSchema.safeParse(base({ variables: [vars[0], vars[0]] })).success);
  assert.ok(!templateInputSchema.safeParse(base({ variables: [{ ...vars[1], defaultValue: "Nowhere" }] })).success);
  const unresolved = base({ status: "published", basePrompt: "{{script}} {{ghost}}" });
  const r = templateInputSchema.safeParse(unresolved);
  assert.ok(!r.success && r.error.issues[0].message.includes("{{ghost}}"));
  assert.ok(templateInputSchema.safeParse({ ...unresolved, status: "draft" }).success); // drafts may be incomplete
});
