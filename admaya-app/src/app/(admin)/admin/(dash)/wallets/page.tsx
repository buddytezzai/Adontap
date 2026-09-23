import WalletsView from "@/components/admin/WalletsView";
import { listWallets } from "@/lib/admin-ops";

export const dynamic = "force-dynamic";

export default async function WalletsPage() {
  const { rows, totalCredits } = await listWallets();
  return <WalletsView rows={rows} totalCredits={totalCredits} />;
}
