import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { createTenantServerClient, getTenantAccessToken } from "../_lib/supabase";
import { getTenantBySlug } from "../_lib/tenant";

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

  const supabase = createTenantServerClient();
  const accessToken = getTenantAccessToken();
  const userResponse = accessToken
    ? await supabase.auth.getUser(accessToken)
    : { data: { user: null } };
  const { user } = userResponse.data;

  if (!user) {
    return (
      <section className="section tenant-message">
        <h2>Access not granted.</h2>
        <p>Contact placement admin.</p>
      </section>
    );
  }

  const { data: membership, error } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !membership) {
    return (
      <section className="section tenant-message">
        <h2>Access not granted.</h2>
        <p>Contact placement admin.</p>
      </section>
    );
  }

  return <>{children}</>;
}
