import { handle, json } from "@/lib/http";
import { listPublishedTemplates } from "@/lib/templates";

// Public: published templates only, sanitised (no costInr, no basePrompt).
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => json({ templates: await listPublishedTemplates() }));
}
