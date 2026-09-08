import type { Database } from "@/lib/supabase/database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

export type MembershipRole = Enums<"membership_role">;
export type MembershipStatus = Enums<"membership_status">;
export type ClassPostType = Enums<"class_post_type">;
export type AssessmentLevel = Enums<"assessment_level">;
