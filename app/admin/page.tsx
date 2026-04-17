import { loadCatalog, getCatalogMeta } from "@/lib/catalog/gloves";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata = { title: "Admin — Kip It Real" };

export default async function AdminPage() {
  const catalog = await loadCatalog({ includeDrafts: true });
  const meta = await getCatalogMeta();
  const adminSecret = process.env.ADMIN_SECRET ?? "";

  return (
    <AdminDashboard
      catalog={catalog}
      meta={meta}
      adminSecret={adminSecret}
    />
  );
}
