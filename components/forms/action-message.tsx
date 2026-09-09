import { cn } from "@/lib/utils";

export function ActionMessage({
  status,
  message,
}: {
  status: "idle" | "success" | "error";
  message?: string;
}) {
  if (status === "idle" || !message) return null;
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={cn("text-sm", status === "error" ? "text-destructive" : "text-primary")}
    >
      {message}
    </p>
  );
}
