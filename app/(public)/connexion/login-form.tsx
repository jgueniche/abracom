"use client";

import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LogInIcon,
  MailCheckIcon,
  SendIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type MagicLinkState,
  type PasswordState,
  requestMagicLink,
  signInWithPassword,
} from "@/server/actions/auth";

const initialLinkState: MagicLinkState = { status: "idle" };
const initialPasswordState: PasswordState = { status: "idle" };

/**
 * Password first, magic link second.
 *
 * The magic link was the default, so the whole school had to go through their
 * inbox to open the app — including on a phone whose mail app is not the one
 * the invitation reached. The e-mail + password everyone was given is the
 * shortest path; the link stays one tap away for whoever forgot theirs.
 */
export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const t = useTranslations("auth.login");
  const [mode, setMode] = useState<"link" | "password">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [linkState, linkAction, linkPending] = useActionState(requestMagicLink, initialLinkState);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialPasswordState,
  );

  if (linkState.status === "sent") {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-xl bg-accent p-5 text-accent-foreground"
      >
        <MailCheckIcon className="size-6" aria-hidden />
        <p className="font-semibold">{t("sentTitle")}</p>
        <p className="text-sm">{t("sentBody", { email: linkState.email ?? "" })}</p>
        <form action={linkAction}>
          <input type="hidden" name="next" value={next} />
          <Button
            type="button"
            variant="link"
            className="px-0"
            onClick={() => window.location.reload()}
          >
            {t("again")}
          </Button>
        </form>
      </div>
    );
  }

  if (mode === "password") {
    const error = passwordState.status === "error" ? passwordState.message : initialError;
    return (
      <form action={passwordAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="min-h-11 pr-11"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
            />
            {/* Seeing what one typed on a phone keyboard: a password given by the school is
                typed, not remembered, and one wrong letter was the whole failed sign-in. */}
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-pressed={showPassword}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {showPassword ? (
                <EyeOffIcon aria-hidden className="size-4" />
              ) : (
                <EyeIcon aria-hidden className="size-4" />
              )}
            </button>
          </div>
        </div>
        {error && (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="min-h-11" disabled={passwordPending}>
          <LogInIcon aria-hidden />
          {passwordPending ? t("signingIn") : t("signIn")}
        </Button>
        <Button
          type="button"
          variant="link"
          className="min-h-11 self-start px-0"
          onClick={() => setMode("link")}
        >
          <SendIcon aria-hidden />
          {t("useLink")}
        </Button>
      </form>
    );
  }

  const error = linkState.status === "error" ? linkState.message : initialError;

  return (
    <form action={linkAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="min-h-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="min-h-11" disabled={linkPending}>
        <SendIcon aria-hidden />
        {linkPending ? t("sending") : t("submit")}
      </Button>
      <Button
        type="button"
        variant="link"
        className="min-h-11 self-start px-0"
        onClick={() => setMode("password")}
      >
        <KeyRoundIcon aria-hidden />
        {t("usePassword")}
      </Button>
    </form>
  );
}
