// Shared by the admin editor (client-side, for friendly toasts) and the admin API (server-side,
// where it is the real gate). Zod issues are turned into one readable sentence.

import { z } from "zod";
import { unresolvedKeys } from "./prompt";
import { ENGINES, STATUSES, VARIABLE_TYPES, engineSupportsImage } from "./types";

export const variableSchema = z
  .object({
    key: z.string().regex(/^\w{1,64}$/, "Variable keys may only contain letters, numbers and underscores"),
    label: z.string().trim().min(1, "Every variable needs a label").max(80, "Variable label is too long"),
    type: z.enum(VARIABLE_TYPES),
    options: z.array(z.string().max(200)).max(50),
    defaultValue: z.string().max(4000, "A default value is too long"),
    editable: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "select") {
      if (v.options.length === 0) {
        ctx.addIssue({ code: "custom", message: `Dropdown "${v.label}" needs at least one option` });
      } else if (!v.options.includes(v.defaultValue)) {
        ctx.addIssue({ code: "custom", message: `Default value of "${v.label}" must be one of its dropdown options` });
      }
    }
  });

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors must be 6-digit hex like #eaa23a");

export const templateInputSchema = z
  .object({
    title: z.string().trim().min(1, "Give the template a name before saving.").max(120, "Template name is too long"),
    category: z.string().trim().max(120, "Category is too long"),
    icon: z.string().min(1, "Pick a card icon").max(16),
    colorFrom: hex,
    colorTo: hex,
    durationSeconds: z.number().int("Duration must be a whole number of seconds").min(1).max(600),
    engine: z.enum(ENGINES),
    costInr: z.number().int("Cost must be a whole number of rupees").min(0).max(10_000_000),
    priceInr: z.number().int("Price must be a whole number of rupees").min(1, "Sell price must be at least ₹1").max(10_000_000),
    gstRate: z.number().min(0).max(1),
    status: z.enum(STATUSES),
    basePrompt: z.string().max(20_000, "Base prompt is too long"),
    inspiredByScoutedAdId: z.string().nullish(),
    variables: z.array(variableSchema).max(40, "Too many variables (max 40)"),
  })
  .superRefine((t, ctx) => {
    const seen = new Set<string>();
    for (const v of t.variables) {
      if (seen.has(v.key)) {
        ctx.addIssue({ code: "custom", path: ["variables"], message: `Two variables share the key "${v.key}" — rename one of them` });
      }
      seen.add(v.key);

      // Validate engine support for image-upload variables
      if (v.type === "image" && !engineSupportsImage(t.engine)) {
        ctx.addIssue({
          code: "custom",
          path: ["variables"],
          message: `Engine "${t.engine}" does not support image upload conditioning. Choose Higgsfield, Runway, or Seedance to use image variables.`,
        });
      }
    }

    // A live template must be able to assemble a complete prompt.
    if (t.status === "published") {
      const missing = unresolvedKeys(t.basePrompt, t.variables.map((v) => v.key));
      if (missing.length) {
        ctx.addIssue({
          code: "custom",
          path: ["basePrompt"],
          message: `Can't publish: the base prompt uses ${missing.map((k) => `{{${k}}}`).join(", ")} but no variable has that key`,
        });
      }
    }
  });

export const statusSchema = z.object({ status: z.enum(STATUSES) });

export const generateSchema = z.object({
  templateId: z.string().min(1).max(64),
  values: z.record(z.string(), z.string()),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const customerRegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().trim().max(100).optional(),
});

export const customerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const adjustCreditsSchema = z.object({
  amount: z.number().int("Amount must be a whole number").refine((n) => n !== 0, "Amount can't be 0").refine((n) => Math.abs(n) <= 1_000_000, "Amount is too large"),
  reason: z.string().trim().min(3, "Give a short reason (3+ characters)").max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, "New password must be at least 10 characters").max(200),
});

export function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "Invalid request";
}
