interface AdminCatchAllPageProps {
  params: {
    path: string[];
  };
}

export default function AdminCatchAllPage({ params }: AdminCatchAllPageProps) {
  return (
    <section className="section">
      <h2>Admin Route</h2>
      <p>Nested admin path:</p>
      <code>/admin/{params.path.join("/")}</code>
    </section>
  );
}
