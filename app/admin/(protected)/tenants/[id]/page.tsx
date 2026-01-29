import Link from "next/link";
import { notFound } from "next/navigation";

import { getSupabaseAdmin } from "../../../_lib/supabase";
import { deleteTenant, updateTenant } from "../actions";

const errorMessages: Record<string, string> = {
  missing_name: "Tenant name is required.",
  invalid_slug: "Slug must be lowercase and contain only letters, numbers, or hyphens.",
};

interface TenantDetailPageProps {
  params: { id: string };
  searchParams?: { error?: string };
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: TenantDetailPageProps) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("id, name, tenant_slug, logo_url, primary_color")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <section className="section">
        <h2>Tenant details</h2>
        <p style={{ color: "crimson" }}>{error.message}</p>
      </section>
    );
  }

  if (!tenant) {
    notFound();
  }

  const errorKey = searchParams?.error ? decodeURIComponent(searchParams.error) : "";
  const errorMessage = errorMessages[errorKey] ?? (errorKey ? errorKey : "");

  return (
    <section className="section">
      <h2>Edit tenant</h2>
      <p>
        <Link href="/admin/tenants">← Back to tenants</Link>
      </p>
      {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}
      <form action={updateTenant}>
        <input type="hidden" name="id" value={tenant.id} />
        <div style={{ display: "grid", gap: "0.75rem", maxWidth: "520px" }}>
          <label>
            Name
            <input name="name" type="text" required defaultValue={tenant.name} />
          </label>
          <label>
            Slug
            <input
              name="tenant_slug"
              type="text"
              pattern="[a-z0-9-]+"
              required
              defaultValue={tenant.tenant_slug}
            />
          </label>
          <label>
            Logo URL (optional)
            <input
              name="logo_url"
              type="url"
              defaultValue={tenant.logo_url ?? ""}
            />
          </label>
          <label>
            Primary color (optional)
            <input
              name="primary_color"
              type="text"
              defaultValue={tenant.primary_color ?? ""}
            />
          </label>
          <button type="submit">Save changes</button>
        </div>
      </form>
      <form action={deleteTenant} style={{ marginTop: "1.5rem" }}>
        <input type="hidden" name="id" value={tenant.id} />
        <button type="submit">Delete tenant</button>
      </form>
    </section>
  );
}
