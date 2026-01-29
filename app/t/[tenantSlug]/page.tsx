interface TenantPageProps {
  params: {
    tenantSlug: string;
  };
}

export default function TenantPage({ params }: TenantPageProps) {
  return (
    <section className="section">
      <h2>Tenant Workspace</h2>
      <p>
        Tenant slug: <strong>{params.tenantSlug}</strong>
      </p>
      <p>
        Add tenant dashboards and experiences under
        <code> /t/{params.tenantSlug}/* </code>.
      </p>
    </section>
  );
}
