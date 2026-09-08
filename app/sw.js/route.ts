import { NextResponse } from "next/server";

import { buildServiceWorker, currentBuildId } from "@/lib/pwa/service-worker";

export const dynamic = "force-static";

/** `/sw.js`: the service worker, versioned by build (see lib/pwa/service-worker.ts). */
export function GET() {
  return new NextResponse(buildServiceWorker(currentBuildId()), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
