import {
  Check,
  CircleQuestionMark,
  Eye,
  SignalHigh,
  SignalLow,
  SignalMedium,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getReadinessLabel,
  getReadinessTone,
  getSeverityTone,
  type DashboardTone,
} from "@/lib/dashboard";
import type { TableEnum } from "@/lib/db";
import { cn } from "@/lib/utils";

const readinessIconMap = {
  critical: TriangleAlert,
  stable: Check,
  unknown: CircleQuestionMark,
  watch: Eye,
} as const;

const severityIconMap = {
  critical: SignalHigh,
  stable: SignalLow,
  unknown: CircleQuestionMark,
  watch: SignalMedium,
} as const;

function getBadgeVariant(tone: DashboardTone) {
  switch (tone) {
    case "critical":
      return "critical";
    case "watch":
      return "watch";
    case "stable":
      return "stable";
    case "unknown":
      return "secondary";
  }
}

export function ReadinessStatusBadge({
  className,
  score,
}: {
  className?: string;
  score: number | null | undefined;
}) {
  const tone = getReadinessTone(score);
  const Icon = readinessIconMap[tone];

  return (
    <Badge className={cn(className)} variant={getBadgeVariant(tone)}>
      <Icon className="size-3.5" />
      {getReadinessLabel(tone)}
    </Badge>
  );
}

export function EventSeverityBadge({
  severity,
}: {
  severity: TableEnum<"event_severity">;
}) {
  const tone = getSeverityTone(severity);
  const Icon = severityIconMap[tone];

  return (
    <Badge variant={getBadgeVariant(tone)}>
      <Icon className="size-3.5" />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}
