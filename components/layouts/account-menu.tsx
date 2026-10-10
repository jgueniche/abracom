"use client";

import {
  BellIcon,
  BookOpenIcon,
  ChevronDownIcon,
  LanguagesIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";
import { Link } from "@/components/ui/link";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import { UserAvatar } from "@/components/domain/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/locale";
import { switchSchool } from "@/server/actions/school";

import { useSignOut } from "./sign-out-button";

/**
 * Account, help and preferences behind the header avatar.
 *
 * These six entries used to be a sixth navigation tab called "Plus", which put
 * "Mon profil" at the same level as "Messages" and hid nothing anyone browses.
 * The tab it frees goes to Devoirs; everything personal now hangs off the
 * avatar, where a signed-in user looks for it.
 */
/** Menu rows are touch targets like any other (project rule: ≥ 44 px). */
const ROW = "min-h-11 px-2";
/** A radio row keeps its right padding: the check mark is drawn there. */
const RADIO_ROW = "min-h-11 pl-2";

export function AccountMenu({
  name,
  initials,
  isParent,
  showStyleGuide,
  schools,
  currentSchoolId,
}: {
  name: string;
  initials: string;
  isParent: boolean;
  showStyleGuide: boolean;
  /** The schools this person works in; the selector shows from two (ADR-0074). */
  schools: { id: string; name: string }[];
  currentSchoolId: string | null;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const tm = useTranslations("more");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const { setTheme } = useTheme();
  const { signOut, pending } = useSignOut();
  const [localePending, startLocale] = useTransition();
  const [schoolPending, startSchool] = useTransition();
  const currentSchool = schools.find((school) => school.id === currentSchoolId);

  function onSchoolChange(value: string) {
    if (value === currentSchoolId) return;
    const data = new FormData();
    data.set("school", value);
    startSchool(async () => {
      await switchSchool(data);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tm("account")}
        className="ml-0.5 flex min-h-11 items-center gap-0.5 rounded-md px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none md:min-h-9"
      >
        <UserAvatar name={name} initials={initials} />
        <ChevronDownIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{name}</span>
          {/* The header hides the school's name on a phone; it is read here. */}
          {currentSchool && schools.length < 2 && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {currentSchool.name}
            </span>
          )}
        </DropdownMenuLabel>
        {/* In the menu itself, not in a submenu: beside a 240 px menu on a phone,
            a submenu had a third of the screen left and wrote over its own names. */}
        {schools.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {tm("switchSchool")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={currentSchoolId ?? ""} onValueChange={onSchoolChange}>
              {schools.map((school) => (
                <DropdownMenuRadioItem
                  key={school.id}
                  value={school.id}
                  disabled={schoolPending}
                  className={RADIO_ROW}
                >
                  <span className="truncate">{school.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={ROW}>
          <Link href="/profil">
            <UserRoundIcon aria-hidden />
            {t("profile")}
          </Link>
        </DropdownMenuItem>
        {isParent && (
          <DropdownMenuItem asChild className={ROW}>
            <Link href="/famille">
              <UsersRoundIcon aria-hidden />
              {t("family")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className={ROW}>
          <Link href="/notifications">
            <BellIcon aria-hidden />
            {t("notifications")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={ROW}>
          <Link href="/aide">
            <BookOpenIcon aria-hidden />
            {tm("help")}
          </Link>
        </DropdownMenuItem>
        {showStyleGuide && (
          <DropdownMenuItem asChild className={ROW}>
            <Link href="/dev/ui">
              <PaletteIcon aria-hidden />
              {t("styleGuide")}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={localePending} className={ROW}>
            <LanguagesIcon aria-hidden />
            {tc("language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(value) => startLocale(() => void setLocale(value as Locale))}
            >
              {locales.map((item) => (
                <DropdownMenuRadioItem key={item} value={item} className={RADIO_ROW}>
                  {tc(`locale.${item}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={ROW}>
            <SunIcon className="dark:hidden" aria-hidden />
            <MoonIcon className="hidden dark:block" aria-hidden />
            {tc("theme.label")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem className={ROW} onSelect={() => setTheme("light")}>
              <SunIcon aria-hidden />
              {tc("theme.light")}
            </DropdownMenuItem>
            <DropdownMenuItem className={ROW} onSelect={() => setTheme("dark")}>
              <MoonIcon aria-hidden />
              {tc("theme.dark")}
            </DropdownMenuItem>
            <DropdownMenuItem className={ROW} onSelect={() => setTheme("system")}>
              <MonitorIcon aria-hidden />
              {tc("theme.system")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={ROW}
          disabled={pending}
          onSelect={signOut}
          variant="destructive"
        >
          <LogOutIcon aria-hidden />
          {tAuth("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
