"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSupabaseAdmin } from "../../_lib/supabase";

const slugPattern = /^[a-z0-9-]+$/;

function normalizeSlug(slug: string) {
  const normalized = slug.trim().toLowerCase();

  if (!normalized || !slugPattern.test(normalized)) {
    return { error: "Slug must be lowercase and contain only letters, numbers, or hyphens." };
  }

  return { value: normalized };
}

function normalizeOptionalValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeCheckbox(value: FormDataEntryValue | null) {
  return value === "on";
}

export async function createTenant(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("tenant_slug") ?? "");
  const logoUrl = normalizeOptionalValue(formData.get("logo_url"));
  const primaryColor = normalizeOptionalValue(formData.get("primary_color"));
  const isActive = normalizeCheckbox(formData.get("is_active"));

  if (!name) {
    redirect("/admin/tenants/new?error=missing_name");
  }

  const slugResult = normalizeSlug(slugInput);
  if ("error" in slugResult) {
    redirect("/admin/tenants/new?error=invalid_slug");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("tenants").insert({
    name,
    tenant_slug: slugResult.value,
    logo_url: logoUrl,
    primary_color: primaryColor,
    is_active: isActive,
  });

  if (error) {
    redirect(
      `/admin/tenants/new?error=${encodeURIComponent(
        error.message || "supabase_error"
      )}`
    );
  }

  revalidatePath("/admin/tenants");
  redirect("/admin/tenants");
}

export async function updateTenant(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("tenant_slug") ?? "");
  const logoUrl = normalizeOptionalValue(formData.get("logo_url"));
  const primaryColor = normalizeOptionalValue(formData.get("primary_color"));
  const isActive = normalizeCheckbox(formData.get("is_active"));

  if (!id) {
    redirect("/admin/tenants?error=missing_id");
  }

  if (!name) {
    redirect(`/admin/tenants/${id}?error=missing_name`);
  }

  const slugResult = normalizeSlug(slugInput);
  if ("error" in slugResult) {
    redirect(`/admin/tenants/${id}?error=invalid_slug`);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("tenants")
    .update({
      name,
      tenant_slug: slugResult.value,
      logo_url: logoUrl,
      primary_color: primaryColor,
      is_active: isActive,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/admin/tenants/${id}?error=${encodeURIComponent(
        error.message || "supabase_error"
      )}`
    );
  }

  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${id}`);
  redirect(`/admin/tenants/${id}`);
}

export async function deleteTenant(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    redirect("/admin/tenants?error=missing_id");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("tenants").delete().eq("id", id);

  if (error) {
    redirect(
      `/admin/tenants?error=${encodeURIComponent(
        error.message || "supabase_error"
      )}`
    );
  }

  revalidatePath("/admin/tenants");
  redirect("/admin/tenants");
}
