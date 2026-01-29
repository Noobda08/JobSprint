import Link from "next/link";

import { createTenant } from "../actions";

const errorMessages: Record<string, string> = {
  missing_name: "Tenant name is required.",
  invalid_slug: "Slug must be lowercase and contain only letters, numbers, or hyphens.",
};

export default function NewTenantPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const error = searchParams?.error ? decodeURIComponent(searchParams.error) : "";
  const errorMessage = errorMessages[error] ?? (error ? error : "");

  return (
    <section className="section">
      <h2>Create tenant</h2>
      <p>
        <Link href="/admin/tenants">← Back to tenants</Link>
      </p>
      {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}
      <form action={createTenant}>
        <div style={{ display: "grid", gap: "0.75rem", maxWidth: "520px" }}>
          <label>
            Name
            <input name="name" type="text" required />
          </label>
          <label>
            Slug
            <input
              name="tenant_slug"
              type="text"
              placeholder="acme-co"
              pattern="[a-z0-9-]+"
              required
            />
          </label>
          <label>
            Logo URL (optional)
            <input name="logo_url" type="url" />
          </label>
          <label>
            Primary color (optional)
            <input name="primary_color" type="text" placeholder="#0ea5e9" />
          </label>
          <button type="submit">Create tenant</button>
        </div>
      </form>
    </section>
  );
}
