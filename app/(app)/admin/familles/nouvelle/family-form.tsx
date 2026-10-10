"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { CredentialsList } from "@/components/domain/credentials-list";
import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SectionHeader } from "@/components/layouts/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { RELATIONS, type Relation } from "@/lib/import/families";
import { type FamilyState, registerFamily } from "@/server/actions/admin/families";

type ClassOption = { id: string; name: string };
type ParentDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relation: Relation;
  locale: "fr" | "en";
};
type ChildDraft = {
  key: number;
  firstName: string;
  lastName: string;
  birthDate: string;
  classId: string;
};

const MAX_CHILDREN = 8;
const SELECT =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm md:min-h-9";
const idle: FamilyState = { status: "idle" };

/** The form, and once it has worked, what it created: a fresh one per family. */
export function FamilyForm({ classes }: { classes: ClassOption[] }) {
  const [round, setRound] = useState(0);
  return <FamilyFormRound key={round} classes={classes} onAnother={() => setRound((n) => n + 1)} />;
}

function FamilyFormRound({
  classes,
  onAnother,
}: {
  classes: ClassOption[];
  onAnother: () => void;
}) {
  const t = useTranslations("admin.families");
  const tFamily = useTranslations("family");
  const tCommon = useTranslations("common");
  const [state, action] = useActionState(registerFamily, idle);
  const [parents, setParents] = useState<ParentDraft[]>([emptyParent("mother")]);
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild(0, "")]);

  if (state.status === "success" && state.credentials) {
    return (
      <div className="flex flex-col gap-6">
        <ActionMessage status="success" message={state.message} />
        <section>
          <SectionHeader label={t("credentialsLabel")} />
          <CredentialsList credentials={state.credentials} />
        </section>
        {state.students && state.students.length > 0 && (
          <section>
            <SectionHeader label={t("childrenLabel")} />
            <ul className="flex flex-col">
              {state.students.map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/admin/familles/${student.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {student.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Button type="button" variant="outline" className="self-start" onClick={onAnother}>
          <PlusIcon aria-hidden />
          {t("another")}
        </Button>
      </div>
    );
  }

  const setParent = (index: number, patch: Partial<ParentDraft>) =>
    setParents((all) => all.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const setChild = (index: number, patch: Partial<ChildDraft>) =>
    setChildren((all) => all.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const payload = JSON.stringify({
    parents,
    children: children.map(({ key: _key, ...child }) => child),
  });

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="payload" value={payload} />

      <section className="flex flex-col gap-5">
        <SectionHeader label={t("parentsLabel")} />
        {parents.map((parent, index) => (
          <fieldset
            key={index}
            className={
              index > 0 ? "flex flex-col gap-4 border-t border-rule pt-5" : "flex flex-col gap-4"
            }
          >
            {/* The legend is the fieldset's first child, or it names nothing. */}
            <legend className="mb-3 text-sm font-semibold">{t("parentN", { n: index + 1 })}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`p${index}-first`} label={t("firstName")}>
                <Input
                  id={`p${index}-first`}
                  value={parent.firstName}
                  onChange={(e) => setParent(index, { firstName: e.target.value })}
                  required
                  maxLength={80}
                  autoComplete="off"
                  className="min-h-11"
                />
              </Field>
              <Field id={`p${index}-last`} label={t("lastName")}>
                <Input
                  id={`p${index}-last`}
                  value={parent.lastName}
                  onChange={(e) => setParent(index, { lastName: e.target.value })}
                  required
                  maxLength={80}
                  autoComplete="off"
                  className="min-h-11"
                />
              </Field>
              <Field id={`p${index}-email`} label={t("email")} className="sm:col-span-2">
                <Input
                  id={`p${index}-email`}
                  type="email"
                  inputMode="email"
                  value={parent.email}
                  onChange={(e) => setParent(index, { email: e.target.value })}
                  required
                  maxLength={254}
                  autoComplete="off"
                  className="min-h-11"
                />
              </Field>
              <Field id={`p${index}-phone`} label={t("phone")}>
                <Input
                  id={`p${index}-phone`}
                  type="tel"
                  inputMode="tel"
                  value={parent.phone}
                  onChange={(e) => setParent(index, { phone: e.target.value })}
                  maxLength={30}
                  autoComplete="off"
                  className="min-h-11"
                />
              </Field>
              <Field id={`p${index}-relation`} label={t("relation")}>
                <select
                  id={`p${index}-relation`}
                  value={parent.relation}
                  onChange={(e) => setParent(index, { relation: e.target.value as Relation })}
                  className={SELECT}
                >
                  {RELATIONS.map((relation) => (
                    <option key={relation} value={relation}>
                      {tFamily(`relation.${relation}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={`p${index}-locale`} label={t("language")}>
                <select
                  id={`p${index}-locale`}
                  value={parent.locale}
                  onChange={(e) => setParent(index, { locale: e.target.value as "fr" | "en" })}
                  className={SELECT}
                >
                  <option value="fr">{tCommon("locale.fr")}</option>
                  <option value="en">{tCommon("locale.en")}</option>
                </select>
              </Field>
            </div>
            {index > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 self-start"
                onClick={() => setParents((all) => all.slice(0, 1))}
              >
                <XIcon aria-hidden />
                {t("removeParent")}
              </Button>
            )}
          </fieldset>
        ))}
        {parents.length < 2 && (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() =>
              setParents((all) => [
                ...all,
                {
                  ...emptyParent(all[0]?.relation === "father" ? "mother" : "father"),
                  lastName: all[0]?.lastName ?? "",
                },
              ])
            }
          >
            <PlusIcon aria-hidden />
            {t("addParent")}
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <SectionHeader label={t("childrenLabel")} />
        {children.map((child, index) => (
          <fieldset
            key={child.key}
            className={
              index > 0 ? "flex flex-col gap-4 border-t border-rule pt-5" : "flex flex-col gap-4"
            }
          >
            <legend className="mb-3 text-sm font-semibold">{t("childN", { n: index + 1 })}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`c${child.key}-first`} label={t("firstName")}>
                <Input
                  id={`c${child.key}-first`}
                  value={child.firstName}
                  onChange={(e) => setChild(index, { firstName: e.target.value })}
                  required
                  maxLength={80}
                  autoComplete="off"
                  className="min-h-11"
                />
              </Field>
              <Field id={`c${child.key}-last`} label={t("lastName")}>
                <Input
                  id={`c${child.key}-last`}
                  value={child.lastName}
                  onChange={(e) => setChild(index, { lastName: e.target.value })}
                  onFocus={() => {
                    // the parents' name, which is the child's more often than not
                    if (!child.lastName && parents[0]?.lastName) {
                      setChild(index, { lastName: parents[0].lastName });
                    }
                  }}
                  required
                  maxLength={80}
                  autoComplete="off"
                  className="min-h-11"
                />
              </Field>
              <Field id={`c${child.key}-birth`} label={t("birthDate")}>
                <Input
                  id={`c${child.key}-birth`}
                  type="date"
                  value={child.birthDate}
                  onChange={(e) => setChild(index, { birthDate: e.target.value })}
                  className="min-h-11"
                />
              </Field>
              <Field id={`c${child.key}-class`} label={t("class")}>
                <select
                  id={`c${child.key}-class`}
                  value={child.classId}
                  onChange={(e) => setChild(index, { classId: e.target.value })}
                  className={SELECT}
                >
                  <option value="">{t("noClass")}</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {index > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 self-start"
                onClick={() => setChildren((all) => all.filter((c) => c.key !== child.key))}
              >
                <XIcon aria-hidden />
                {t("removeChild")}
              </Button>
            )}
          </fieldset>
        ))}
        {children.length < MAX_CHILDREN && (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() =>
              setChildren((all) => [
                ...all,
                emptyChild((all.at(-1)?.key ?? 0) + 1, parents[0]?.lastName ?? ""),
              ])
            }
          >
            <PlusIcon aria-hidden />
            {t("addChild")}
          </Button>
        )}
        {classes.length === 0 && <p className="text-xs text-muted-foreground">{t("noClasses")}</p>}
      </section>

      <div className="flex flex-col gap-3 border-t border-rule pt-5">
        <p className="text-xs text-pretty text-muted-foreground">{t("whatHappens")}</p>
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `flex flex-col gap-2 ${className}` : "flex flex-col gap-2"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function emptyParent(relation: Relation): ParentDraft {
  return { firstName: "", lastName: "", email: "", phone: "", relation, locale: "fr" };
}

function emptyChild(key: number, lastName: string): ChildDraft {
  return { key, firstName: "", lastName, birthDate: "", classId: "" };
}
