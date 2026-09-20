import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth";
import { listTemplatesAdmin } from "@/lib/templates";

export const dynamic = "force-dynamic";

// Everything under /admin except /admin/login. The session is verified here on the server, and again
// inside every /api/admin/* handler — the UI gate is a convenience, the API gate is the real one.
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const templates = await listTemplatesAdmin();
  return <AdminShell initialTemplates={templates}>{children}</AdminShell>;
}
