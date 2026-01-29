export default function HomePage() {
  return (
    <section className="section">
      <h2>Welcome to JobSprint</h2>
      <p>
        The Next.js App Router is now configured at the repository root. Explore
        the admin and tenant areas to begin building experiences for each role.
      </p>
      <ul>
        <li>
          <strong>/admin</strong> – administration dashboard entry point.
        </li>
        <li>
          <strong>/t/[tenantSlug]</strong> – tenant-specific surface.
        </li>
      </ul>
    </section>
  );
}
