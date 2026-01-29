import { createTenantServerClient } from "./supabase";

export interface TenantProfile {
  id: string;
  name: string;
  tenant_slug: string;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean | null;
}

export async function getTenantBySlug(tenantSlug: string) {
  const supabase = createTenantServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, tenant_slug, logo_url, primary_color, is_active")
    .eq("tenant_slug", tenantSlug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as TenantProfile | null;
}
