import { LogOutIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";

export async function SignOutButton({ className }: { className?: string }) {
  const t = await getTranslations("auth");
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline" className={className}>
        <LogOutIcon aria-hidden />
        {t("signOut")}
      </Button>
    </form>
  );
}
