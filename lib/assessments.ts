/** Mirror of the `assessment_level` enum (client-safe). */
export const ASSESSMENT_LEVELS = ["not_yet", "in_progress", "acquired", "mastered"] as const;
export type AssessmentLevel = (typeof ASSESSMENT_LEVELS)[number];
