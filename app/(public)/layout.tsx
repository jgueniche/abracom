import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layouts/site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[23rem] flex-1 flex-col justify-center px-5 py-12">
        {children}
      </main>
    </div>
  );
}
