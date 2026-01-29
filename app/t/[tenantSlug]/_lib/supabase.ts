import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const authTokenCookieSuffix = "-auth-token";

function getAccessTokenFromCookies() {
  const cookieStore = cookies();
  const directToken =
    cookieStore.get("sb-access-token")?.value ??
    cookieStore.get("supabase-auth-token")?.value;

  if (directToken) {
    return directToken;
  }

  const authCookie = cookieStore
    .getAll()
    .find((cookie) => cookie.name.endsWith(authTokenCookieSuffix));

  if (!authCookie) {
    return null;
  }

  try {
    const parsed = JSON.parse(authCookie.value) as { access_token?: string };
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

export function createTenantServerClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const accessToken = getAccessTokenFromCookies();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export function getTenantAccessToken() {
  return getAccessTokenFromCookies();
}
