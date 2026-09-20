import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { listScoutedAdsAdmin } from "@/lib/scraper";

export async function GET(req: Request) {
  const auth = await requireAdminApi(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const sortBy = (searchParams.get("sortBy") as "votes" | "recent") || "votes";

  const ads = await listScoutedAdsAdmin(category, sortBy);
  return NextResponse.json({ ads }, { headers: { "Cache-Control": "no-store" } });
}
