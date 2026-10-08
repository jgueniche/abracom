/**
 * The characters of the test school someone may enter as (ADR-0073).
 *
 * One account per role the application has, chosen so that each opens a screen
 * worth trying: the CP teacher holds the class with homework and a timetable,
 * parent-1 has two children in two classes, guardian-005 is a grand-parent who
 * reads and never writes. The addresses are the seed's (`*@demo.local`), which
 * is fictitious by construction.
 */
export const TEST_PERSONAS = {
  direction: "admin@demo.local",
  secretariat: "staff@demo.local",
  teacher: "teacher-05@demo.local",
  parent: "parent-1@demo.local",
  guardian: "guardian-005@demo.local",
} as const;

export type TestPersona = keyof typeof TEST_PERSONAS;

export const TEST_PERSONA_KEYS = Object.keys(TEST_PERSONAS) as [TestPersona, ...TestPersona[]];
