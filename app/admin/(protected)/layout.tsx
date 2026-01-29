import type { ReactNode } from "react";

import { requireSuperadmin } from "../_lib/auth";

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSuperadmin();

  return <>{children}</>;
}
