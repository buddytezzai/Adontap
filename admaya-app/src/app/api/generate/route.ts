import { randomUUID } from "node:crypto";
import { chargeCredits, getCustomerUser, refundCredits } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { resolveValues } from "@/lib/generate";
import { generateVideo, isHiggsfieldConfigured } from "@/lib/higgsfield";
import { BadRequestError, handle, json, readJson } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { gstFor } from "@/lib/pricing";
import { assemblePrompt } from "@/lib/prompt";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getPublishedTemplateForGeneration, recordGeneration } from "@/lib/templates";
import type { GenerateResult } from "@/lib/types";
import { generateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
// A real render is polled for up to 5 minutes inside this request (see TODO below).
export const maxDuration = 300;

class RenderFailedError extends Error {}

function getTemplateSampleUrl(template: { title: string }): string {
  const t = template.title.toLowerCase();
  if (t.includes("unbox")) return "/samples/unbox.jpg";
  if (t.includes("before") || t.includes("transform")) return "/samples/before-after.jpg";
  if (t.includes("walkthrough") || t.includes("app")) return "/samples/app-demo.jpg";
  if (t.includes("founder")) return "/samples/founder.jpg";
  if (t.includes("review") || t.includes("customer")) return "/samples/review.jpg";
  if (t.includes("feature")) return "/samples/feature.jpg";
  if (t.includes("offer") || t.includes("limited")) return "/samples/offer.jpg";
  if (t.includes("street") || t.includes("interview")) return "/samples/street.jpg";
  return "/samples/unbox.jpg";
}

export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
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

    // The assembled prompt lives on the server only. It is stored on the Generation row.
    const assembledPrompt = assemblePrompt(template.basePrompt, resolved.values);
    const gstInr = gstFor(template.priceInr, template.gstRate);
    const totalInr = template.priceInr + gstInr;

    // A REAL (provider-billed, credit-charged) render needs all three: a signed-in customer, an engine we
    // can actually call, and provider credentials. Everyone else — including every anonymous visitor —
    // gets the simulated render and can never cause provider spend.
    const user = await getCustomerUser();
    const realRender =
      Boolean(user) && (template.engine === "Higgsfield" || template.engine === "Seedance") && isHiggsfieldConfigured();

    let chargedInr = 0;
    if (realRender && user) {
      if (!rateLimit(`render:${user.id}`, 5, 60_000).ok) return json({ error: "Too many renders at once — try again shortly." }, 429);
      // Atomic "take it if they have it": concurrent requests cannot overspend or go negative.
      if (!(await chargeCredits(user.id, totalInr))) {
        return json({ error: `Insufficient credits — this render costs ₹${totalInr}. Top up your wallet and try again.` }, 402);
      }
      chargedInr = totalInr;
    }

    let videoUrl: string | null = null;
    let providerRequestId: string | undefined;
    let renderedSeconds = template.durationSeconds;
    try {
      if (realRender) {
        // TODO: make this asynchronous — return "queued" and let the client poll — instead of holding the request open.
        const hf = await generateVideo(assembledPrompt, template.durationSeconds);
        if (hf.status !== "completed" || !hf.videoUrl) {
          console.error(`[generate] provider render did not complete (${hf.status}): ${hf.error}`);
          throw new RenderFailedError();
        }
        videoUrl = hf.videoUrl;
        providerRequestId = hf.requestId;
        renderedSeconds = hf.renderedSeconds ?? renderedSeconds;
      } else {
        // TODO: swap in real provider adapters for HeyGen / Runway / Google Veo here.
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (e) {
      // Never keep money for a render we didn't deliver.
      if (user && chargedInr > 0) {
        await refundCredits(user.id, chargedInr).catch((err) =>
          console.error(`[generate] REFUND FAILED — user ${user.id} owed ₹${chargedInr}`, err),
        );
      }
      if (e instanceof RenderFailedError) {
        return json({ error: "The render didn't complete, and you have not been charged. Please try again." }, 502);
      }
      throw e;
    }

    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24-hour retention (see /api/cron/cleanup)
    const storageUrl = videoUrl ?? getTemplateSampleUrl(template);
    let generationId = "";
    try {
      generationId = await recordGeneration({
        userId: user?.id ?? null,
        templateId: template.id,
        templateTitle: template.title,
        submittedValues: submitted,
        assembledPrompt,
        chargeInr: chargedInr > 0 ? template.priceInr : 0,
        gstInr: chargedInr > 0 ? gstInr : 0,
      });
      if (user) {
        await prisma.$transaction([
          ...(chargedInr > 0
            ? [
                prisma.order.create({
                  data: {
                    userId: user.id,
                    templateId: template.id,
                    amountPaidInr: chargedInr,
                    submittedValues: submitted,
                    refundEligible: false,
                    status: "completed",
                  },
                }),
              ]
            : []),
          prisma.asset.create({
            data: {
              id: `gen-${randomUUID()}`,
              userId: user.id,
              templateId: template.id,
              type: "generated",
              storageUrl,
              expiresAt,
              metadata: {
                generationId,
                engine: template.engine,
                durationSeconds: renderedSeconds,
                pricePaid: chargedInr,
                providerRequestId,
              },
            },
          }),
        ]);
      }
    } catch (e) {
      // The render is delivered and paid for; a bookkeeping failure must not turn that into an error.
      console.error(`[generate] render delivered but records failed to save (generation ${generationId || "n/a"})`, e);
    }

    const result: GenerateResult = {
      generationId,
      status: "complete",
      title: template.title,
      durationSeconds: renderedSeconds,
      engine: template.engine,
      priceInr: template.priceInr,
      gstInr,
      totalInr,
      chargedInr,
      assetUrl: storageUrl,
      videoReady: Boolean(videoUrl),
      videoUrl: videoUrl ?? undefined,
      expiresAt: expiresAt.toISOString(),
    };
    return json(result);
  });
}
