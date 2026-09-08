"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/annonces", key: "announcements" },
  { href: "/admin/documents", key: "documents" },
  { href: "/admin/evenements", key: "events" },
  { href: "/admin/familles", key: "families" },
  { href: "/admin/classes", key: "classes" },
  { href: "/admin/utilisateurs", key: "members" },
  { href: "/admin/annees", key: "years" },
  { href: "/admin/import", key: "import" },
  { href: "/admin/signalements", key: "reports" },
  { href: "/admin/communaute", key: "community" },
  { href: "/admin/formulaires", key: "forms" },
  { href: "/admin/journal", key: "audit" },
] as const;

export function AdminNav() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-full border px-4 text-sm font-medium",
                  active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
