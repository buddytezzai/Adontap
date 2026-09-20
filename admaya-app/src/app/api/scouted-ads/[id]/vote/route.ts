import { getCustomerUser } from "@/lib/customer-auth";
import { handle, json, UnauthorizedError } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { toggleVote } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await getCustomerUser();
    if (!user) throw new UnauthorizedError("Please log in to vote for templates");
    const { id } = await ctx.params;
    return json({ ok: true, ...(await toggleVote(id, user.id)) });
  });
}
