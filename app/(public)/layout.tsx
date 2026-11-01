import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layouts/site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      {/* Each page sets its own measure: the sign-in page is two halves on a wide screen, the
          test-space door a single narrow column (ADR-0085). */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
