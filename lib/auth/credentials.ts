/**
 * What the school hands over for one account, shown once on the screen that
 * created it and never stored anywhere (ADR-0075). `password` is null for an
 * account that already existed: it keeps the password its owner chose.
 */
export type Credential = { name: string; email: string; password: string | null };

export type CredentialsState = {
  status: "idle" | "success" | "error";
  message?: string;
  credentials?: Credential[];
};

export const noCredentials: CredentialsState = { status: "idle" };
