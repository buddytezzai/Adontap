import { getCustomerUser } from "@/lib/customer-auth";
import { handle, json } from "@/lib/http";
import { listScoutedAdsPublic } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const category = new URL(req.url).searchParams.get("category") || undefined;
    const user = await getCustomerUser();
    return json({ ads: await listScoutedAdsPublic(user?.id, category) });
  });
}
