import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { syncScoutedAds } from "@/lib/scraper";

export async function POST(req: Request) {
  const auth = await requireAdminApi(req);
  if (auth instanceof Response) return auth;

  try {
    const result = await syncScoutedAds();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to sync Meta ads";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
