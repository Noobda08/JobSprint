import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getTenantBySlug, requireTenantMembership } from "../../../../lib/tenant";

interface TenantProtectedLayoutProps {
  children: ReactNode;
  params: { tenantSlug: string };
}

export default async function TenantProtectedLayout({
  children,
  params,
}: TenantProtectedLayoutProps) {
  const tenant = await getTenantBySlug(params.tenantSlug);

  if (!tenant) {
    notFound();
  }

  if (tenant.is_active === false) {
    return (
      <section className="section tenant-message">
        <h2>Tenant inactive.</h2>
        <p>Please contact JobSprint support for help reactivating access.</p>
      </section>
    );
  }

  const { membership } = await requireTenantMembership(tenant.id);

  if (!membership) {
    return (
      <section className="section tenant-message">
        <h2>Access not granted.</h2>
        <p>Contact placement admin.</p>
      </section>
    );
  }

  return <>{children}</>;
}
