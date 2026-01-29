import Link from "next/link";

interface TenantLoginPageProps {
  params: { tenantSlug: string };
}

export default function TenantLoginPage({ params }: TenantLoginPageProps) {
  return (
    <section className="section">
      <h2>Tenant login</h2>
      <p>
        Sign in to access the {params.tenantSlug} placement portal. If you need
        access, contact your placement admin.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="tenant-primary-button" type="button">
          Continue with JobSprint
        </button>
        <Link href={`/t/${params.tenantSlug}/dashboard`}>View dashboard</Link>
      </div>
    </section>
  );
}
