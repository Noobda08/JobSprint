"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "dashboard" },
  { label: "Eligibility", href: "eligibility" },
  { label: "Counselling", href: "counselling" },
];

interface TenantNavProps {
  tenantSlug: string;
}

export default function TenantNav({ tenantSlug }: TenantNavProps) {
  const pathname = usePathname();

  return (
    <nav className="section">
      <ul className="tenant-nav">
        {navItems.map((item) => {
          const href = `/t/${tenantSlug}/${item.href}`;
          const isActive = pathname === href;
          return (
            <li key={item.href}>
              <Link href={href} className={isActive ? "active" : ""}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
