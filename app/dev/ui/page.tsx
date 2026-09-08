import {
  BookOpenIcon,
  CalendarDaysIcon,
  CheckIcon,
  MegaphoneIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ToastDemo } from "@/components/dev/toast-demo";
import { TokenSwatches, type TokenPair } from "@/components/dev/token-swatches";
import { SiteHeader } from "@/components/layouts/site-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { brand } from "@/lib/design/tokens";

const THEME_PAIRS: TokenPair[] = [
  { bg: "background", fg: "foreground" },
  { bg: "surface", fg: "surface-foreground" },
  { bg: "card", fg: "card-foreground" },
  { bg: "primary", fg: "primary-foreground" },
  { bg: "secondary", fg: "secondary-foreground" },
  { bg: "accent", fg: "accent-foreground" },
  { bg: "muted", fg: "muted-foreground" },
  { bg: "background", fg: "muted-foreground", label: "muted-foreground" },
  { bg: "destructive", fg: "white", label: "destructive" },
];

const SECTIONS = [
  "palette",
  "typography",
  "buttons",
  "forms",
  "feedback",
  "cards",
  "icons",
] as const;

/** Visible in development and on Vercel preview deployments, 404 in production. */
const isStyleGuideHidden =
  process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

/**
 * Style guide (session 2): live tokens, typography, components and domain card
 * previews for visual validation by the project owner.
 */
export default async function DevUiPage() {
  if (isStyleGuideHidden) notFound();

  const t = await getTranslations("devUi");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">{t("title")}</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">{t("subtitle")}</p>
          <nav aria-label={t("title")} className="flex flex-wrap gap-2">
            {SECTIONS.map((section) => (
              <Button key={section} asChild variant="outline" size="sm">
                <a href={`#${section}`}>{t(`sections.${section}`)}</a>
              </Button>
            ))}
          </nav>
        </header>

        {/* ── Palette ─────────────────────────────────────────────────── */}
        <section id="palette" className="flex scroll-mt-20 flex-col gap-6">
          <h2 className="text-2xl font-semibold">{t("sections.palette")}</h2>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {t("palette.brand")}
            </h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(brand).map(([name, hex]) => (
                <li key={name} className="flex flex-col gap-2">
                  <div className="h-16 rounded-xl border" style={{ backgroundColor: hex }} />
                  <p className="text-sm font-medium">brand-{name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{hex}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {t("palette.themeTokens")}
            </h3>
            <TokenSwatches pairs={THEME_PAIRS} />
          </div>
        </section>

        {/* ── Typography ──────────────────────────────────────────────── */}
        <section id="typography" className="flex scroll-mt-20 flex-col gap-6">
          <h2 className="text-2xl font-semibold">{t("sections.typography")}</h2>
          <Card>
            <CardHeader>
              <CardTitle>{t("typography.heading")}</CardTitle>
              <CardDescription>{t("typography.body")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-5xl font-semibold">{t("typography.sample")}</p>
              <p className="text-3xl font-semibold">{t("typography.sample")}</p>
              <p className="text-xl font-semibold">{t("typography.sample")}</p>
              <Separator />
              <p className="font-sans text-lg">{t("typography.lead")}</p>
              <p className="font-sans">{t("typography.sample")}</p>
              <p className="font-sans text-sm text-muted-foreground">{t("typography.muted")}</p>
              <p className="font-mono text-sm">0123456789 · Europe/Paris · 18:30</p>
            </CardContent>
          </Card>
        </section>

        {/* ── Buttons ─────────────────────────────────────────────────── */}
        <section id="buttons" className="flex scroll-mt-20 flex-col gap-6">
          <h2 className="text-2xl font-semibold">{t("sections.buttons")}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>{t("buttons.default")}</Button>
            <Button variant="secondary">{t("buttons.secondary")}</Button>
            <Button variant="outline">{t("buttons.outline")}</Button>
            <Button variant="ghost">{t("buttons.ghost")}</Button>
            <Button variant="link">{t("buttons.link")}</Button>
            <Button variant="destructive">{t("buttons.destructive")}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">{t("buttons.small")}</Button>
            <Button>{t("buttons.default")}</Button>
            <Button size="lg">{t("buttons.large")}</Button>
            <Button size="icon" aria-label={t("buttons.icon")}>
              <PlusIcon />
            </Button>
            <Button variant="outline" size="icon" aria-label={t("buttons.icon")}>
              <SearchIcon />
            </Button>
            <Button disabled>{t("buttons.default")}</Button>
          </div>
        </section>

        {/* ── Forms ───────────────────────────────────────────────────── */}
        <section id="forms" className="flex scroll-mt-20 flex-col gap-6">
          <h2 className="text-2xl font-semibold">{t("sections.forms")}</h2>
          <Card>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="demo-email">{t("forms.email")}</Label>
                <Input
                  id="demo-email"
                  type="email"
                  placeholder={t("forms.emailPlaceholder")}
                  className="min-h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="demo-child">{t("forms.child")}</Label>
                <Select>
                  <SelectTrigger id="demo-child" className="min-h-11 w-full">
                    <SelectValue placeholder={t("forms.childPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">{t("mock.studentName")} · PS</SelectItem>
                    <SelectItem value="b">{t("mock.studentName")} · CP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="demo-message">{t("forms.message")}</Label>
                <Textarea id="demo-message" placeholder={t("forms.messagePlaceholder")} rows={3} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border p-3 sm:col-span-2">
                <div className="flex flex-col">
                  <Label htmlFor="demo-push">{t("forms.notifications")}</Label>
                  <p className="text-sm text-muted-foreground">{t("forms.notificationsHint")}</p>
                </div>
                <Switch id="demo-push" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Feedback & overlays ─────────────────────────────────────── */}
        <section id="feedback" className="flex scroll-mt-20 flex-col gap-6">
          <h2 className="text-2xl font-semibold">{t("sections.feedback")}</h2>
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="min-h-11">{t("feedback.openDialog")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("feedback.dialogTitle")}</DialogTitle>
                  <DialogDescription>{t("feedback.dialogDescription")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("feedback.cancel")}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button>
                      <CheckIcon aria-hidden />
                      {t("feedback.confirm")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" className="min-h-11">
                  {t("feedback.openSheet")}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>{t("feedback.sheetTitle")}</SheetTitle>
                  <SheetDescription>{t("feedback.sheetDescription")}</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
            <ToastDemo />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" className="min-h-11">
                  {t("feedback.tooltip")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("feedback.tooltipText")}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{t("mock.announcementBadge")}</Badge>
            <Badge variant="secondary">{t("mock.homeworkBadge")}</Badge>
            <Badge variant="outline">{t("mock.eventBadge")}</Badge>
            <Badge variant="destructive">{t("palette.fail")}</Badge>
          </div>
          <Tabs defaultValue="today">
            <TabsList>
              <TabsTrigger value="today">{t("mock.tabs.today")}</TabsTrigger>
              <TabsTrigger value="week">{t("mock.tabs.week")}</TabsTrigger>
              <TabsTrigger value="month">{t("mock.tabs.month")}</TabsTrigger>
            </TabsList>
            {(["today", "week", "month"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="text-sm text-muted-foreground">
                {t("mock.tabContent", { tab: t(`mock.tabs.${tab}`) })}
              </TabsContent>
            ))}
          </Tabs>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("feedback.loading")}</p>
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Domain cards (static previews) ──────────────────────────── */}
        <section id="cards" className="flex scroll-mt-20 flex-col gap-6">
          <h2 className="text-2xl font-semibold">{t("sections.cards")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge>
                    <MegaphoneIcon aria-hidden />
                    {t("mock.announcementBadge")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("mock.readCount", { read: 18, total: 24 })}
                  </span>
                </div>
                <CardTitle>{t("mock.announcementTitle")}</CardTitle>
                <CardDescription>{t("mock.announcementBody")}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="min-h-11 w-full">
                  <CheckIcon aria-hidden />
                  {t("mock.ack")}
                </Button>
              </CardFooter>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    <BookOpenIcon aria-hidden />
                    {t("mock.homeworkBadge")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{t("mock.homeworkDue")}</span>
                </div>
                <CardTitle>{t("mock.homeworkTitle")}</CardTitle>
                <CardDescription>{t("mock.className")}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-accent text-accent-foreground">PF</AvatarFallback>
                </Avatar>
                <span className="text-sm">{t("mock.studentName")}</span>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="min-h-11 w-full">
                  <CheckIcon aria-hidden />
                  {t("mock.seen")}
                </Button>
              </CardFooter>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <CalendarDaysIcon aria-hidden />
                    {t("mock.eventBadge")}
                  </Badge>
                </div>
                <CardTitle>{t("mock.eventTitle")}</CardTitle>
                <CardDescription>{t("mock.eventWhen")}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="secondary" className="min-h-11 w-full">
                  {t("mock.rsvp")}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* ── PWA icons ───────────────────────────────────────────────── */}
        <section id="icons" className="flex scroll-mt-20 flex-col gap-6">
          <h2 className="text-2xl font-semibold">{t("sections.icons")}</h2>
          <p className="text-sm text-muted-foreground">{t("icons.description")}</p>
          <div className="flex flex-wrap items-end gap-6">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={96}
              height={96}
              loading="eager"
              className="rounded-2xl border"
            />
            <Image
              src="/icons/icon-maskable-192.png"
              alt=""
              width={96}
              height={96}
              loading="eager"
              className="rounded-full border"
            />
            <Image
              src="/brand/logo-abravanel.png"
              alt="Institutions Abravanel"
              width={240}
              height={158}
              loading="eager"
              className="rounded-xl border bg-white p-2"
            />
          </div>
        </section>
      </main>
    </>
  );
}
