import { redirect } from "next/navigation";

interface TenantLandingPageProps {
  params: { tenantSlug: string };
}

export default function TenantLandingPage({ params }: TenantLandingPageProps) {
  redirect(`/t/${params.tenantSlug}/dashboard`);
}
