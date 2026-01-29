import Link from "next/link";

export default function AdminPage() {
  return (
    <section className="section">
      <h2>Admin Portal</h2>
      <p>
        Manage tenants, superadmin access, and other shared resources from this
        dashboard.
      </p>
      <p>
        <Link href="/admin/tenants">Go to tenant management →</Link>
      </p>
    </section>
  );
}
