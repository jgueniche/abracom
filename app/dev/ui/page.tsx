import { notFound } from "next/navigation";

/**
 * Style guide page — filled in during session 2 (visual identity).
 * Hidden in production.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold">/dev/ui</h1>
      <p className="mt-2 text-muted-foreground">
        Page de style à venir (session 2 : palette dérivée du logo, typographies, composants).
      </p>
    </main>
  );
}
