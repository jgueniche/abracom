"use client";

import { MailCheckIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type MagicLinkState, requestMagicLink } from "@/server/actions/auth";

const initialState: MagicLinkState = { status: "idle" };

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const t = useTranslations("auth.login");
  const [state, formAction, isPending] = useActionState(requestMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-2xl bg-accent p-5 text-accent-foreground"
      >
        <MailCheckIcon className="size-6" aria-hidden />
        <p className="font-semibold">{t("sentTitle")}</p>
        <p className="text-sm">{t("sentBody", { email: state.email ?? "" })}</p>
        <form action={formAction}>
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

  const error = state.status === "error" ? state.message : initialError;

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
      <Button type="submit" className="min-h-11" disabled={isPending}>
        <SendIcon aria-hidden />
        {isPending ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
