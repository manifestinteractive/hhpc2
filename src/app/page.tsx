import Link from "next/link";
import {
  ArrowRight,
  Database,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { BootstrapStatusGrid } from "@/components/bootstrap/bootstrap-status-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getEnvironmentSummary } from "@/lib/health";

const phaseZeroMilestones = [
  {
    title: "Application scaffold",
    description:
      "Next.js 16 App Router, TypeScript strict mode, Tailwind v4, and a source-based component system.",
    icon: Workflow,
  },
  {
    title: "Environment contract",
    description:
      "Documented server and public env keys, runtime diagnostics, and a repeatable local setup path.",
    icon: ShieldCheck,
  },
  {
    title: "Supabase wiring",
    description:
      "CLI workflow, health validation, and a clean handoff into Phase 1 schema implementation.",
    icon: Database,
  },
  {
    title: "AI workspace",
    description:
      "Shared repo guidance for Codex, Cursor, and Claude Code with Next.js doc-first rules.",
    icon: Sparkles,
  },
];

export default function Home() {
  const environment = getEnvironmentSummary();

  return (
    <main className="bg-background relative flex min-h-screen flex-col overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.20),_transparent_55%)]" />
      <div className="via-border absolute inset-x-0 top-16 h-px bg-gradient-to-r from-transparent to-transparent" />

      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-6 py-12 md:px-10 lg:px-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-5">
            <Badge
              variant={
                environment.status === "healthy" ? "default" : "secondary"
              }
            >
              Phase 0 Bootstrap{" "}
              {environment.status === "healthy" ? "Ready" : "In Progress"}
            </Badge>
            <div className="space-y-4">
              <h1 className="text-foreground max-w-4xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
                Crew readiness infrastructure, built before product logic.
              </h1>
              <p className="text-muted-foreground max-w-2xl text-lg leading-8 text-pretty">
                This repository now starts as a disciplined internal platform:
                app shell, validation workflow, AI-agent guidance, and
                Supabase-ready delivery foundations. Core persistence work
                starts in Phase 1.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/api/health">
                API health
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/api/health/dependencies">Dependency health</Link>
            </Button>
          </div>
        </div>

        <BootstrapStatusGrid summary={environment} />

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/80 bg-card/95 shadow-[0_18px_80px_rgba(9,26,31,0.08)]">
            <CardHeader>
              <CardTitle>Phase 0 implementation surface</CardTitle>
              <CardDescription>
                The app is intentionally focused on engineering readiness, not
                crew data features.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {phaseZeroMilestones.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="border-border/70 bg-background/80 rounded-2xl border p-5 shadow-sm"
                >
                  <div className="border-border/80 bg-muted/70 mb-4 inline-flex rounded-full border p-2">
                    <Icon className="text-accent-foreground size-4" />
                  </div>
                  <h2 className="text-foreground text-lg font-medium">
                    {title}
                  </h2>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Immediate next steps</CardTitle>
              <CardDescription>
                These items finish local readiness before Phase 1 starts.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4 text-sm">
              <div>
                <p className="text-foreground font-medium">
                  1. Install dependencies
                </p>
                <p>
                  Run the documented `pnpm` workflow to generate the lockfile
                  and local toolchain.
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-foreground font-medium">
                  2. Start local Supabase
                </p>
                <p>
                  Initialize the Supabase project and confirm
                  `/api/health/dependencies` reports connectivity.
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-foreground font-medium">
                  3. Lock AI client setup
                </p>
                <p>
                  Use the root guidance files plus `.cursor/rules` to keep
                  agents inside Phase 0 boundaries.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}
