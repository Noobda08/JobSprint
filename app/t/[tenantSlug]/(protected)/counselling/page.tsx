import Link from "next/link";

interface TenantCounsellingPageProps {
  params: { tenantSlug: string };
}

export default function TenantCounsellingPage({
  params,
}: TenantCounsellingPageProps) {
  return (
    <section className="section">
      <h2>Counselling</h2>
      <p>
        Plan coaching sessions and share resources with {params.tenantSlug}
        candidates.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="tenant-primary-button" type="button">
          Schedule counselling
        </button>
        <Link href={`/t/${params.tenantSlug}/dashboard`}>Back to dashboard</Link>
      </div>
    </section>
  );
}
