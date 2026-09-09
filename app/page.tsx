import { redirect } from "next/navigation";

import { APP_HOME_PATH, LOGIN_PATH } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? APP_HOME_PATH : LOGIN_PATH);
}
