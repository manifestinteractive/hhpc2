import type { EnvironmentSummary } from "@/types/app";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BootstrapStatusGridProps = {
  summary: EnvironmentSummary;
};

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "accent";
}) {
  return (
    <div className="border-border/80 bg-background/85 rounded-2xl border p-4">
      <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold tracking-tight ${
          tone === "accent" ? "text-accent-foreground" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function BootstrapStatusGrid({ summary }: BootstrapStatusGridProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Bootstrap readiness</CardTitle>
          <CardDescription>
            Phase 0 tracks environment readiness separately from application
            features.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <SummaryStat
            label="Required keys"
            value={String(
              summary.checks.filter((check) => check.required).length,
            )}
            tone="default"
          />
          <SummaryStat
            label="Missing now"
            value={String(summary.missingRequiredKeys.length)}
            tone={
              summary.missingRequiredKeys.length === 0 ? "default" : "accent"
            }
          />
          <SummaryStat
            label="Optional wired"
            value={String(summary.configuredOptionalKeys.length)}
            tone="default"
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Environment contract</CardTitle>
          <CardDescription>
            Required keys are the minimum needed for a fully wired local
            bootstrap.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {summary.checks.map((check) => (
            <div
              key={check.key}
              className="border-border/70 bg-background/70 flex items-start justify-between gap-4 rounded-2xl border px-4 py-3"
            >
              <div>
                <p className="text-foreground font-mono text-sm">{check.key}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {check.description}
                </p>
              </div>
              <Badge variant={check.present ? "default" : "secondary"}>
                {check.present ? check.source : "missing"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
