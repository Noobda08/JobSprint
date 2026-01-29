import { cookies } from "next/headers";

import { getSupabaseAdmin } from "./supabase";

const ADMIN_USER_COOKIE = "admin_user_id";

export async function verifySuperadmin(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("superadmins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export function setAdminUserCookie(userId: string) {
  const cookieStore = cookies();
  cookieStore.set(ADMIN_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
  });
}

export function clearAdminUserCookie() {
  const cookieStore = cookies();
  cookieStore.set(ADMIN_USER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    expires: new Date(0),
  });
}
