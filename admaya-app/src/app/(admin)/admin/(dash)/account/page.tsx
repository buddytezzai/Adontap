import AccountView from "@/components/admin/AccountView";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const admin = await requireAdminPage();
  return <AccountView email={admin.email} />;
}
