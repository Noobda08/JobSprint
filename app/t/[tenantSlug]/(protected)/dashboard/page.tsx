import Link from "next/link";

interface TenantDashboardPageProps {
  params: { tenantSlug: string };
}

export default function TenantDashboardPage({
  params,
}: TenantDashboardPageProps) {
  return (
    <section className="section">
      <h2>Dashboard</h2>
      <p>
        Welcome to your {params.tenantSlug} placement workspace. Track candidate
        progress and upcoming milestones from here.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="tenant-primary-button" type="button">
          Create placement task
        </button>
        <Link href={`/t/${params.tenantSlug}/eligibility`}>
          Review eligibility
        </Link>
      </div>
    </section>
  );
}
