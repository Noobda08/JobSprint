import type { ReactNode } from "react";

import { requireSuperadmin } from "../../../lib/tenant";

interface AdminProtectedLayoutProps {
  children: ReactNode;
}

export default async function AdminProtectedLayout({
  children,
}: AdminProtectedLayoutProps) {
  await requireSuperadmin();

  return <>{children}</>;
}
