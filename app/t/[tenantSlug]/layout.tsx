import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";

import TenantNav from "./_components/tenant-nav";
import { getTenantBySlug } from "../../../lib/tenant";
import "./tenant.css";

interface TenantLayoutProps {
  children: ReactNode;
  params: { tenantSlug: string };
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
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

  const primaryColor = tenant.primary_color ?? "#0ea5e9";

  return (
    <div
      className="tenant-shell"
      style={{ "--tenant-primary": primaryColor } as CSSProperties}
    >
      <header className="section tenant-header">
        <div className="tenant-brand">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={`${tenant.name} logo`}
              className="tenant-logo"
            />
          ) : null}
          <div>
            <p className="badge">Tenant Workspace</p>
            <h2>{tenant.name}</h2>
            <p>Workspace: /t/{tenant.tenant_slug}</p>
          </div>
        </div>
      </header>
      <TenantNav tenantSlug={params.tenantSlug} />
      {children}
    </div>
  );
}
