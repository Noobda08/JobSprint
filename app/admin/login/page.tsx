import { redirect } from "next/navigation";

import { setAdminUserCookie, verifySuperadmin } from "../_lib/auth";

const errorMessages: Record<string, string> = {
  missing_user_id: "Enter a user id to continue.",
  not_superadmin: "That user is not a superadmin.",
};

async function loginAction(formData: FormData) {
  "use server";
  const userId = String(formData.get("user_id") ?? "").trim();

  if (!userId) {
    redirect("/admin/login?error=missing_user_id");
  }

  const isSuperadmin = await verifySuperadmin(userId);

  if (!isSuperadmin) {
    redirect("/admin/login?error=not_superadmin");
  }

  setAdminUserCookie(userId);
  redirect("/admin/tenants");
}

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const errorKey = searchParams?.error ? decodeURIComponent(searchParams.error) : "";
  const errorMessage = errorMessages[errorKey] ?? (errorKey ? errorKey : "");

  return (
    <section className="section">
      <h2>Admin login</h2>
      <p>Enter your superadmin user id to manage tenants.</p>
      {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}
      <form action={loginAction}>
        <div style={{ display: "grid", gap: "0.75rem", maxWidth: "420px" }}>
          <label>
            User ID
            <input name="user_id" type="text" placeholder="UUID" required />
          </label>
          <button type="submit">Continue</button>
        </div>
      </form>
    </section>
  );
}
