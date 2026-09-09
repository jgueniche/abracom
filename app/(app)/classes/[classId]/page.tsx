import { redirect } from "next/navigation";

/**
 * The class space opens on Homework. The old index was a "Fil" tab that
 * re-listed Homework and Journal together, so every post appeared twice.
 */
export default async function ClassIndexPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  redirect(`/classes/${classId}/devoirs`);
}
