import { resolveValues } from "@/lib/generate";
import { BadRequestError, handle, json, readJson } from "@/lib/http";
import { gstFor } from "@/lib/pricing";
import { assemblePrompt } from "@/lib/prompt";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getPublishedTemplateForGeneration, recordGeneration } from "@/lib/templates";
import type { GenerateResult } from "@/lib/types";
import { generateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Simulated render latency, matching the prototype's fake progress bar.
const SIMULATED_RENDER_MS = 700;

export function POST(req: Request) {
  return handle(async () => {
    const limit = rateLimit(`generate:${clientIp(req)}`, 20, 60_000);
    if (!limit.ok) return json({ error: "Too many requests — try again shortly." }, 429);

    const body = generateSchema.safeParse(await readJson(req));
    if (!body.success) throw new BadRequestError("Expected { templateId: string, values: { [key]: string } }");
    const { templateId, values: submitted } = body.data;

    const template = await getPublishedTemplateForGeneration(templateId);
    if (!template) return json({ error: "Template not found" }, 404);

    // TRUST BOUNDARY: only values for `editable` variables are taken from the request. Locked
    // variables — and any unknown keys — are dropped; the stored defaults are used instead.
    const resolved = resolveValues(template.variables, submitted);
    if (!resolved.ok) throw new BadRequestError(resolved.error);
    if (resolved.ignoredKeys.length) {
      console.warn(`[generate] ignored non-editable keys for template ${template.id}: ${resolved.ignoredKeys.join(", ")}`);
    }

    // The assembled prompt lives on the server only. It is stored on the Generation row and would
    // be handed to the render provider; it is never part of the response.
    const assembledPrompt = assemblePrompt(template.basePrompt, resolved.values);
    const gstInr = gstFor(template.priceInr, template.gstRate);
    const generationId = await recordGeneration({
      templateId: template.id,
      templateTitle: template.title,
      submittedValues: submitted,
      assembledPrompt,
      chargeInr: template.priceInr,
      gstInr,
    });

    // TODO: swap in real provider adapter here (Seedance / Higgsfield / HeyGen / Runway / Google Veo).
    //       It receives `assembledPrompt`, returns a job id, and this handler would then respond
    //       with status "queued" and let the client poll — instead of simulating success below.
    // TODO: swap in real payment capture here (charge priceInr + gstInr before rendering).
    await new Promise((r) => setTimeout(r, SIMULATED_RENDER_MS));

    const result: GenerateResult = {
      generationId,
      status: "complete",
      title: template.title,
      durationSeconds: template.durationSeconds,
      engine: template.engine,
      priceInr: template.priceInr,
      gstInr,
      totalInr: template.priceInr + gstInr,
    };
    return json(result);
  });
}
