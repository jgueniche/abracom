"use client";

import { CloudOffIcon, LogOutIcon, RefreshCwIcon, UserCheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { avatarTone } from "@/components/domain/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type MarkInput, markAttendance } from "@/server/actions/attendance";

export type GridStudent = {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
  status: "present" | "absent" | "late" | "excused" | null;
  arrivedAt: string | null;
  departedAt: string | null;
  pickupUserId: string | null;
  pickupName: string | null;
  declaredAbsent: boolean;
  pickupOptions: { userId: string; name: string }[];
};

type Pending = { key: string; input: MarkInput };

/**
 * The grid, used standing up, with one hand, and a child pulling on a sleeve.
 *
 * One tap marks a child present and stamps the time; a second tap undoes it.
 * Nothing else to learn. In departure mode a tap asks who is collecting the
 * child, among that child's authorised guardians only — the list comes from the
 * database, which also refuses anyone else.
 *
 * The entrance hall has no reliable wifi, so every tap is queued locally before
 * it is sent, replayed in order when the network returns, and carries the time
 * of the tap rather than the time of the send. A lost tap is worse than a slow
 * one.
 */
export function AttendanceGrid({
  sessionId,
  students,
  recordsPickup,
  closed,
}: {
  sessionId: string;
  students: GridStudent[];
  recordsPickup: boolean;
  closed: boolean;
}) {
  const t = useTranslations("attendance");
  const format = useFormatter();
  const [rows, setRows] = useState(students);
  const [mode, setMode] = useState<"arrival" | "departure">("arrival");
  const [missingOnly, setMissingOnly] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickupFor, setPickupFor] = useState<GridStudent | null>(null);
  const flushing = useRef(false);
  const storageKey = `kesher-attendance-${sessionId}`;

  // ── the queue, kept where a reload can find it ─────────────────────────────
  // Storage is the single source of truth, never React state: a tap made while
  // a send was in flight used to be appended to a stale copy of the queue and
  // resurrect gestures that had already left, so an undo could come back as a
  // second arrival.
  const readQueue = useCallback((): Pending[] => {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as Pending[];
    } catch {
      return [];
    }
  }, [storageKey]);

  const persist = useCallback(
    (queue: Pending[]) => {
      setPending(queue);
      try {
        if (queue.length === 0) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, JSON.stringify(queue));
      } catch {
        // A private window may refuse storage; the send still happens.
      }
    },
    [storageKey],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (;;) {
        const next = readQueue()[0];
        if (!next) break;
        let result;
        try {
          result = await markAttendance(next.input);
        } catch {
          setOnline(false);
          break; // still offline: keep the queue, in order
        }
        setOnline(true);
        if (result.status === "error") {
          // A refusal will not become acceptable by being retried.
          setError(result.message ?? t("saveError"));
        }
        // Re-read: taps made during the send were appended behind this one.
        persist(readQueue().slice(1));
      }
    } finally {
      flushing.current = false;
    }
  }, [persist, readQueue, t]);

  useEffect(() => {
    const stored = readQueue();
    if (stored.length > 0) setPending(stored);
    setOnline(navigator.onLine);
    void flush();
    const back = () => {
      setOnline(true);
      void flush();
    };
    const gone = () => setOnline(false);
    window.addEventListener("online", back);
    window.addEventListener("offline", gone);
    const timer = window.setInterval(() => void flush(), 15000);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", gone);
      window.clearInterval(timer);
    };
  }, [flush, readQueue, storageKey]);

  const enqueue = (input: MarkInput) => {
    setError(null);
    persist([...readQueue(), { key: `${input.studentId}-${Date.now()}`, input }]);
    void flush();
  };

  // ── the gestures ───────────────────────────────────────────────────────────
  const tapArrival = (student: GridStudent) => {
    if (closed) return;
    const at = new Date().toISOString();
    const clearing = student.status !== null && student.departedAt === null;
    setRows((current) =>
      current.map((row) =>
        row.id === student.id
          ? clearing
            ? { ...row, status: null, arrivedAt: null, departedAt: null, pickupName: null }
            : { ...row, status: "present", arrivedAt: at }
          : row,
      ),
    );
    enqueue({
      sessionId,
      studentId: student.id,
      status: clearing ? null : "present",
      at,
      departure: false,
      pickupUserId: null,
      pickupNote: null,
    });
  };

  const confirmDeparture = (student: GridStudent, pickupUserId: string, note: string) => {
    const at = new Date().toISOString();
    const pickupName = student.pickupOptions.find((o) => o.userId === pickupUserId)?.name ?? null;
    setRows((current) =>
      current.map((row) =>
        row.id === student.id ? { ...row, departedAt: at, pickupUserId, pickupName } : row,
      ),
    );
    enqueue({
      sessionId,
      studentId: student.id,
      status: student.status ?? "present",
      at,
      departure: true,
      pickupUserId,
      pickupNote: note.trim() === "" ? null : note.trim(),
    });
    setPickupFor(null);
  };

  const present = rows.filter((r) => r.status === "present" || r.status === "late");
  const declaredAbsent = rows.filter((r) => r.declaredAbsent && r.status === null);
  const missing = rows.filter((r) => r.status === null && !r.declaredAbsent);
  const shown = missingOnly ? missing : rows;

  return (
    <div className="flex flex-col gap-4">
      {/* Readable from across the hall, and it never scrolls away. */}
      <div className="sticky top-[calc(var(--nav-h)+0.5rem)] z-10 flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        <p className="text-lg font-semibold tabular-nums sm:text-xl">
          {t("counter", {
            present: present.length,
            expected: missing.length,
            absent: declaredAbsent.length,
          })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={missingOnly ? "default" : "outline"}
            onClick={() => setMissingOnly((v) => !v)}
            className="min-h-11"
          >
            {missingOnly ? t("showEveryone") : t("whoIsMissing")}
          </Button>
          {recordsPickup && !closed && (
            <Button
              type="button"
              variant={mode === "departure" ? "default" : "outline"}
              onClick={() => setMode((m) => (m === "arrival" ? "departure" : "arrival"))}
              className="min-h-11"
            >
              {mode === "departure" ? <UserCheckIcon aria-hidden /> : <LogOutIcon aria-hidden />}
              {mode === "departure" ? t("modeArrival") : t("modeDeparture")}
            </Button>
          )}
          {pending.length > 0 && (
            <Badge variant="outline" className="gap-1">
              {online ? (
                <RefreshCwIcon className="size-3 animate-spin" aria-hidden />
              ) : (
                <CloudOffIcon className="size-3" aria-hidden />
              )}
              {t("queued", { count: pending.length })}
            </Badge>
          )}
        </div>
        {error && <p className="text-sm font-medium text-brick">{error}</p>}
        {closed && <p className="text-sm text-muted-foreground">{t("closedNotice")}</p>}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {shown.map((student) => {
          const here = student.status === "present" || student.status === "late";
          const gone = student.departedAt !== null;
          return (
            <li key={student.id}>
              <button
                type="button"
                disabled={closed || (mode === "departure" && !here)}
                onClick={() => (mode === "departure" ? setPickupFor(student) : tapArrival(student))}
                aria-pressed={here}
                className={cn(
                  // Far beyond the 44 px of the design system: this is used
                  // standing, one-handed.
                  "flex min-h-[8.5rem] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition disabled:opacity-50",
                  gone
                    ? "border-border bg-muted"
                    : here
                      ? "border-success bg-success/12"
                      : student.declaredAbsent
                        ? "border-dashed border-border bg-card"
                        : "border-border bg-card hover:border-primary",
                )}
              >
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-full text-base font-semibold",
                    avatarTone(`${student.firstName} ${student.lastName}`),
                  )}
                  aria-hidden
                >
                  {student.firstName.charAt(0)}
                  {student.lastName.charAt(0)}
                </span>
                <span className="text-lg leading-tight font-semibold">{student.firstName}</span>
                <span className="text-xs text-muted-foreground">{student.lastName}</span>
                {gone ? (
                  <span className="text-xs font-medium">
                    {t("leftAt", {
                      time: format.dateTime(new Date(student.departedAt!), {
                        timeStyle: "short",
                      }),
                    })}
                    {student.pickupName ? ` · ${student.pickupName}` : ""}
                  </span>
                ) : here ? (
                  <span className="text-xs font-medium text-success">
                    {student.arrivedAt
                      ? format.dateTime(new Date(student.arrivedAt), { timeStyle: "short" })
                      : t("statuses.present")}
                  </span>
                ) : student.declaredAbsent ? (
                  <span className="text-xs text-muted-foreground">{t("declaredAbsent")}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("expected")}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <p className="rounded-xl border border-border bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground">
          {missingOnly ? t("nobodyMissing") : t("emptyRoster")}
        </p>
      )}

      <PickupDialog
        student={pickupFor}
        onClose={() => setPickupFor(null)}
        onConfirm={confirmDeparture}
      />
    </div>
  );
}

/** Who is collecting the child — among that child's authorised guardians only. */
function PickupDialog({
  student,
  onClose,
  onConfirm,
}: {
  student: GridStudent | null;
  onClose: () => void;
  onConfirm: (student: GridStudent, pickupUserId: string, note: string) => void;
}) {
  const t = useTranslations("attendance");
  const [choice, setChoice] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setChoice(student?.pickupOptions[0]?.userId ?? "");
    setNote("");
  }, [student]);

  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("pickupTitle", { name: student?.firstName ?? "" })}</DialogTitle>
          <DialogDescription>{t("pickupHint")}</DialogDescription>
        </DialogHeader>
        {student && student.pickupOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPickupOption")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">
                {t("pickupTitle", { name: student?.firstName ?? "" })}
              </legend>
              {student?.pickupOptions.map((option) => (
                <label
                  key={option.userId}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-base has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="pickup"
                    value={option.userId}
                    checked={choice === option.userId}
                    onChange={() => setChoice(option.userId)}
                    className="size-5 accent-primary"
                  />
                  {option.name}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pickup-note">{t("pickupNote")}</Label>
              <Input
                id="pickup-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={200}
                className="min-h-11"
              />
            </div>
            <Button
              type="button"
              disabled={choice === ""}
              onClick={() => student && onConfirm(student, choice, note)}
              className="min-h-12"
            >
              {t("confirmDeparture")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
