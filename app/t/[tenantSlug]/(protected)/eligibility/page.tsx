import Link from "next/link";

interface TenantEligibilityPageProps {
  params: { tenantSlug: string };
}

export default function TenantEligibilityPage({
  params,
}: TenantEligibilityPageProps) {
  return (
    <section className="section">
      <h2>Eligibility</h2>
      <p>
        Review eligibility snapshots for {params.tenantSlug} candidates and
        confirm they are cleared for placement.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="tenant-primary-button" type="button">
          Run eligibility check
        </button>
        <Link href={`/t/${params.tenantSlug}/counselling`}>
          Go to counselling
        </Link>
      </div>
    </section>
  );
}
