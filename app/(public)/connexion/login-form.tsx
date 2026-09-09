"use client";

import { KeyRoundIcon, LogInIcon, MailCheckIcon, SendIcon } from "lucide-react";
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

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const t = useTranslations("auth.login");
  const [mode, setMode] = useState<"link" | "password">("link");
  const [linkState, linkAction, linkPending] = useActionState(requestMagicLink, initialLinkState);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialPasswordState,
  );

  if (linkState.status === "sent") {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-2xl bg-accent p-5 text-accent-foreground"
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
    const error = passwordState.status === "error" ? passwordState.message : undefined;
    return (
      <form action={passwordAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <p className="text-sm text-muted-foreground">{t("passwordHint")}</p>
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
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
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
