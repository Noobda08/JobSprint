interface TenantCatchAllPageProps {
  params: {
    tenantSlug: string;
    path: string[];
  };
}

export default function TenantCatchAllPage({
  params,
}: TenantCatchAllPageProps) {
  return (
    <section className="section">
      <h2>Tenant Route</h2>
      <p>
        Tenant slug: <strong>{params.tenantSlug}</strong>
      </p>
      <p>Nested path:</p>
      <code>/t/{params.tenantSlug}/{params.path.join("/")}</code>
    </section>
  );
}
