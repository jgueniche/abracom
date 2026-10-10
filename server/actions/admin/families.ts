"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import type { Credential, CredentialsState } from "@/lib/auth/credentials";
import { assertSchoolContext } from "@/lib/auth/guards";
import { temporaryPassword } from "@/lib/auth/temporary-password";
import { RELATIONS } from "@/lib/import/families";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureAccount } from "@/server/actions/admin/accounts";

import { field, toActionError, uuid } from "./_shared";

const parentSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  phone: z.string().trim().max(30),
  relation: z.enum(RELATIONS),
  locale: z.enum(["fr", "en"]),
});

const childSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  birthDate: z.union([z.iso.date(), z.literal("")]),
  classId: z.union([z.string().regex(uuid), z.literal("")]),
});

const familySchema = z.object({
  parents: z.array(parentSchema).min(1).max(2),
  children: z.array(childSchema).min(1).max(8),
});

export type FamilyState = CredentialsState & {
  /** The children registered, for the links to their records. */
  students?: { id: string; name: string }[];
};

/**
 * « Nouvelle famille » (ADR-0075): the direction registers one or two parents
 * and their children in one go, from the e-mail the family sent.
 *
 * The parents' accounts are opened first (an auth account is not a row this
 * database writes), each with its own provisional password; then everything
 * else — family, children, classes, links, memberships — in one transaction
 * (`create_family`). If that transaction refuses, the accounts opened a moment
 * earlier are deleted again: otherwise a second attempt would find them, call
 * them « existing », and nobody would ever see their password.
 */
export async function registerFamily(
  _previous: FamilyState,
  formData: FormData,
): Promise<FamilyState> {
  try {
    const t = await getTranslations("admin.families");
    const { schoolId } = await assertSchoolContext(["school_admin"]);

    let payload: unknown;
    try {
      payload = JSON.parse(field(formData, "payload"));
    } catch {
      return { status: "error", message: t("invalid") };
    }
    const parsed = familySchema.safeParse(payload);
    if (!parsed.success) return { status: "error", message: t("invalid") };
    const { parents, children } = parsed.data;
    if (new Set(parents.map((p) => p.email)).size !== parents.length) {
      return { status: "error", message: t("sameEmail") };
    }

    // Said before any account is opened: a class must be one of this year's.
    const supabase = await createClient();
    const classIds = [...new Set(children.map((c) => c.classId).filter(Boolean))];
    if (classIds.length > 0) {
      const { data: classes, error } = await supabase
        .from("classes")
        .select("id, school_year:school_years!inner(is_current)")
        .eq("school_id", schoolId)
        .eq("archived", false)
        .eq("school_year.is_current", true)
        .in("id", classIds);
      if (error) throw new Error(error.message);
      if ((classes ?? []).length !== classIds.length) {
        return { status: "error", message: t("classUnknown") };
      }
    }

    const admin = createAdminClient();
    const opened: string[] = [];
    const credentials: Credential[] = [];
    const accounts: { userId: string; relation: string }[] = [];
    try {
      for (const parent of parents) {
        const password = temporaryPassword();
        const account = await ensureAccount(admin, {
          email: parent.email,
          firstName: parent.firstName,
          lastName: parent.lastName,
          locale: parent.locale,
          phone: parent.phone || null,
          password,
        });
        if (account.created) opened.push(account.userId);
        accounts.push({ userId: account.userId, relation: parent.relation });
        credentials.push({
          name: `${parent.firstName} ${parent.lastName}`,
          email: parent.email,
          password: account.created ? password : null,
        });
      }

      const surnames = [...new Set(parents.map((p) => p.lastName))].join(" – ");
      const { data: studentIds, error } = await supabase.rpc("create_family", {
        p_school: schoolId,
        p_family_name: t("familyName", { names: surnames }),
        p_parents: accounts.map((account, index) => ({
          user_id: account.userId,
          relation: account.relation,
          is_primary: index === 0,
        })),
        p_children: children.map((child) => ({
          first_name: child.firstName,
          last_name: child.lastName,
          birth_date: child.birthDate,
          class_id: child.classId,
        })),
      });
      if (error) throw new FamilyRefused(error.code, error.message);

      revalidatePath("/admin", "layout");
      return {
        status: "success",
        message: t("registered"),
        credentials,
        students: (studentIds ?? []).map((id, index) => ({
          id,
          name: `${children[index]!.firstName} ${children[index]!.lastName}`,
        })),
      };
    } catch (error) {
      await Promise.all(opened.map((id) => admin.auth.admin.deleteUser(id)));
      if (error instanceof FamilyRefused && error.code === "22023") {
        return { status: "error", message: t("invalid") };
      }
      throw error;
    }
  } catch (error) {
    return toActionError(error);
  }
}

class FamilyRefused extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FamilyRefused";
  }
}
