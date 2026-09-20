import { notFound } from "next/navigation";
import Storefront from "@/components/site/Storefront";
import { getPublishedTemplate } from "@/lib/templates";

export const dynamic = "force-dynamic";

// Deep link straight into the Studio for one template. Drafts/archived/unknown ids are a real 404.
export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getPublishedTemplate(id);
  if (!template) notFound();
  return <Storefront initialTemplateId={template.id} scrollToStudio />;
}
