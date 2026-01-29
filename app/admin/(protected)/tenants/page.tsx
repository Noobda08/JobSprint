import Link from "next/link";

import { getSupabaseAdmin } from "../../_lib/supabase";
import { deleteTenant } from "./actions";

interface TenantRow {
  id: string;
  name: string;
  tenant_slug: string;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
  created_at: string;
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: tenants, error } = await supabaseAdmin
    .from("tenants")
    .select(
      "id, name, tenant_slug, logo_url, primary_color, is_active, created_at"
    )
    .order("created_at", { ascending: false });

  return (
    <section className="section">
      <h2>Tenant Management</h2>
      <p>
        <Link href="/admin/tenants/new">Create a new tenant →</Link>
      </p>
      {searchParams?.error ? (
        <p style={{ color: "crimson" }}>
          Error: {decodeURIComponent(searchParams.error)}
        </p>
      ) : null}
      {error ? (
        <p style={{ color: "crimson" }}>
          Failed to load tenants: {error.message}
        </p>
      ) : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Slug</th>
              <th align="left">Branding</th>
              <th align="left">Status</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(tenants ?? []).map((tenant: TenantRow) => (
              <tr key={tenant.id}>
                <td>{tenant.name}</td>
                <td>{tenant.tenant_slug}</td>
                <td>
                  {tenant.logo_url ? (
                    <div>Logo: {tenant.logo_url}</div>
                  ) : (
                    <div>No logo</div>
                  )}
                  {tenant.primary_color ? (
                    <div>Primary: {tenant.primary_color}</div>
                  ) : (
                    <div>No primary color</div>
                  )}
                </td>
                <td>{tenant.is_active ? "Active" : "Inactive"}</td>
                <td>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <Link href={`/admin/tenants/${tenant.id}`}>Edit</Link>
                    <form action={deleteTenant}>
                      <input type="hidden" name="id" value={tenant.id} />
                      <button type="submit">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!tenants?.length ? (
              <tr>
                <td colSpan={5}>No tenants created yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
