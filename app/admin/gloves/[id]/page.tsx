import { notFound } from "next/navigation";
import { loadGloveById } from "@/lib/catalog/gloves";
import { GloveForm } from "@/components/admin/GloveForm";

export const metadata = { title: "Edit Glove — Kip It Real Admin" };

interface EditGlovePageProps {
  params: { id: string };
}

export default async function EditGlovePage({ params }: EditGlovePageProps) {
  const glove = await loadGloveById(params.id, { includeDrafts: true });
  if (!glove) notFound();

  const adminSecret = process.env.ADMIN_SECRET ?? "";

  return (
    <div>
      <h1 className="section-heading mb-2">Edit glove</h1>
      <p className="mb-8 text-sm text-brand-support font-mono">{glove.id}</p>
      <GloveForm mode="edit" initial={glove} adminSecret={adminSecret} />
    </div>
  );
}
