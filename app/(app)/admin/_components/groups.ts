/**
 * The twelve management destinations, in four named families.
 *
 * Twelve flat pills measured 1 372 px: on any screen, finding "Journal" meant
 * scrolling sideways — including on a 1 920 px display with 928 px of empty
 * space beside it.
 *
 * `adminOnly` entries belong to the direction alone. The secretariat used to
 * see them in the sidebar, click them, and be sent back to the home page
 * without a word — two of its twelve entries were dead.
 *
 * Shared by the navigation (a client component) and the section index (a server
 * component), so the two can never drift apart.
 */
export const ADMIN_GROUPS = [
  {
    key: "publications",
    items: [
      { href: "/admin/annonces", key: "announcements" },
      { href: "/admin/documents", key: "documents" },
      { href: "/admin/evenements", key: "events" },
      { href: "/admin/formulaires", key: "forms" },
    ],
  },
  {
    key: "people",
    items: [
      { href: "/admin/familles", key: "families" },
      { href: "/admin/classes", key: "classes" },
      { href: "/admin/utilisateurs", key: "members" },
      { href: "/admin/import", key: "import", adminOnly: true },
      { href: "/admin/pointage", key: "attendance", adminOnly: true },
    ],
  },
  {
    key: "moderation",
    items: [
      { href: "/admin/signalements", key: "reports" },
      { href: "/admin/communaute", key: "community" },
      { href: "/admin/messagerie", key: "messaging", adminOnly: true },
    ],
  },
  {
    key: "year",
    items: [
      { href: "/admin/annees", key: "years" },
      { href: "/admin/journal", key: "audit", adminOnly: true },
    ],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  items: ReadonlyArray<{ href: string; key: string; adminOnly?: boolean }>;
}>;

export type AdminItem = { href: string; key: string };
export type AdminGroup = { key: string; items: AdminItem[] };

/** The families this reader may actually open, empty ones dropped. */
export function adminGroupsFor(isAdmin: boolean): AdminGroup[] {
  return ADMIN_GROUPS.map((group) => ({
    key: group.key,
    items: group.items
      .filter((item) => isAdmin || !("adminOnly" in item && item.adminOnly))
      .map((item) => ({ href: item.href, key: item.key })),
  })).filter((group) => group.items.length > 0);
}
