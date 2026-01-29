import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createTenantServerClient,
  getTenantAccessToken,
} from "../../app/t/[tenantSlug]/_lib/supabase";
import { getSupabaseAdmin } from "../../app/admin/_lib/supabase";

const ADMIN_USER_COOKIE = "admin_user_id";

export interface TenantProfile {
  id: string;
  name: string;
  tenant_slug: string;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean | null;
}

export interface TenantMembershipResult {
  user: { id: string } | null;
  membership: { id: string } | null;
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

export async function requireSuperadmin() {
  const cookieStore = cookies();
  const userId = cookieStore.get(ADMIN_USER_COOKIE)?.value;

  if (!userId) {
    redirect("/admin/login");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("superadmins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    redirect("/admin/login");
  }

  return { userId };
}

export async function requireTenantMembership(
  tenantId: string
): Promise<TenantMembershipResult> {
  const supabase = createTenantServerClient();
  const accessToken = getTenantAccessToken();
  const userResponse = accessToken
    ? await supabase.auth.getUser(accessToken)
    : { data: { user: null } };
  const { user } = userResponse.data;

  if (!user) {
    return { user: null, membership: null };
  }

  const { data: membership, error } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !membership) {
    return { user: { id: user.id }, membership: null };
  }

  return { user: { id: user.id }, membership };
}
