import { PageLoading } from "@/components/layouts/page-loading";

/** Loading boundary: the shell stays, the page area answers the click at once (ADR-0068). */
export default function Loading() {
  return <PageLoading />;
}
