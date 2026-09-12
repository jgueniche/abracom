import { redirect } from "next/navigation";

/**
 * The class space opens on the cahier de vie.
 *
 * It used to open on Homework, decided in session 16 when the class space had
 * no sibling: the old "Fil" tab re-listed Homework and Journal together, so
 * every post appeared twice, and Homework was the sensible landing once it was
 * gone. Session 17 then gave homework a tab of its own in the main bar — the
 * diary merged across every child — without revisiting where "Ma classe"
 * lands. Since then, two of the five tabs on a parent's phone opened the same
 * screen: 40 % of the bar spent on one destination.
 *
 * The cahier de vie is the right landing on its own merits, and not only
 * because it frees the duplicate. It is the class's daily life — what the
 * family opens the application to see — and every product in this space
 * (Klassly, Educartable, Seesaw, ClassDojo) leads with that feed rather than
 * with an assignment list. Homework keeps its own tab, where it belongs and
 * where it covers every child at once.
 */
export default async function ClassIndexPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  redirect(`/classes/${classId}/cahier`);
}
