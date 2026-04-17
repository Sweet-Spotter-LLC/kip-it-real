import { GloveForm } from "@/components/admin/GloveForm";

export const metadata = { title: "New Glove — Kip It Real Admin" };

export default function NewGlovePage() {
  const adminSecret = process.env.ADMIN_SECRET ?? "";
  return (
    <div>
      <h1 className="section-heading mb-8">New glove</h1>
      <GloveForm mode="create" adminSecret={adminSecret} />
    </div>
  );
}
