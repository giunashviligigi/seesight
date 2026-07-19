import type { UserRole } from "@/lib/api/auth";

export type NavItem = {
  href: string;
  label: string;
  /** Path prefixes that mark this item active (defaults to href). */
  matchPrefixes?: string[];
};

/** In-app home for the SEESIGHT logo when authenticated. */
export function getHomeHref(role: UserRole): string {
  return role === "SUPER_ADMIN" ? "/companies" : "/dashboard";
}

export function getNavItems(role: UserRole): NavItem[] {
  if (role === "SUPER_ADMIN") {
    return [
      { href: "/companies", label: "companies" },
      { href: "/account", label: "account" },
    ];
  }

  if (role === "EMPLOYEE") {
    return [
      { href: "/dashboard", label: "dashboard" },
      { href: "/trips", label: "trips", matchPrefixes: ["/trips"] },
      { href: "/notifications", label: "notifications" },
      { href: "/profile", label: "profile" },
      { href: "/account", label: "account" },
    ];
  }

  // COMPANY_ADMIN
  return [
    { href: "/dashboard", label: "dashboard" },
    { href: "/trips", label: "trips", matchPrefixes: ["/trips"] },
    { href: "/approvals", label: "approvals" },
    { href: "/reports", label: "reports" },
    { href: "/notifications", label: "notifications" },
    { href: "/employees", label: "employees" },
    { href: "/company", label: "company" },
    { href: "/account", label: "account" },
  ];
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const prefixes = item.matchPrefixes ?? [item.href];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
