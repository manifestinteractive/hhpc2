"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { getReadinessLabel, getReadinessTone, type ReadinessProfilePoint } from "@/lib/dashboard";

const chartConfig = {
  criticalBand: {
    color: "color-mix(in srgb, var(--color-critical) 25%, transparent)",
    label: "Critical band",
  },
  profile: {
    color: "var(--foreground)",
    label: "Readiness profile",
  },
  stableBand: {
    color: "color-mix(in srgb, var(--color-stable) 25%, transparent)",
    label: "Stable band",
  },
  watchBand: {
    color: "color-mix(in srgb, var(--color-watch) 25%, transparent)",
    label: "Watch band",
  },
} satisfies ChartConfig;

function formatTone(score: number) {
  const tone = getReadinessTone(score);
  return getReadinessLabel(tone);
}

function getToneColor(score: number) {
  const tone = getReadinessTone(score);
  return `var(--color-${tone})`;
}

function formatProfileAxisLabel(label: string) {
  switch (label) {
    case "Cardiovascular":
      return "Cardio";
    case "Activity balance":
      return "Activity";
    case "Data quality":
      return "Data";
    case "Event burden":
      return "Events";
    default:
      return label;
  }
}

function ReadinessProfileTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: {
      label: string;
      score: number;
    };
  }>;
}) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs/relaxed shadow-xl">
      <div className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
        {point.label}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>Readiness</span>
        <span className="font-mono tabular-nums text-foreground">
          {Math.round(point.score)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>Status band</span>
        <span className="font-semibold" style={{ color: getToneColor(point.score) }}>
          {formatTone(point.score)}
        </span>
      </div>
    </div>
  );
}

export function ReadinessProfileChart({
  points,
}: {
  points: ReadinessProfilePoint[];
}) {
  if (points.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/50 px-6 text-center text-sm text-muted-foreground min-[1281px]:h-full min-[1281px]:min-h-0">
        No readiness profile is available until scoring has run for this crew.
      </div>
    );
  }

  const chartData = points.map((point) => ({
    axisLabel: formatProfileAxisLabel(point.label),
    ...point,
    criticalBand: 55,
    profile: point.score,
    stableBand: 100,
    watchBand: 75,
  }));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Readiness profile</h2>
        <p className="text-muted-foreground text-sm leading-6">
          Each spoke is standardized to a 0 to 100 readiness score. Outer rings
          indicate more stable operating conditions.
        </p>
      </div>

      <ChartContainer
        config={chartConfig}
        className="min-h-[280px] w-full max-w-[19rem] self-center min-[420px]:max-w-[21rem] sm:max-w-none min-[1281px]:h-full min-[1281px]:min-h-0 min-[1281px]:aspect-auto"
      >
        <RadarChart
          accessibilityLayer
          cx="50%"
          cy="50%"
          data={chartData}
          margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
          outerRadius="72%"
        >
          <ChartTooltip
            content={<ReadinessProfileTooltip />}
            cursor={false}
          />
          <PolarGrid
            gridType="polygon"
            radialLines={false}
            stroke="color-mix(in srgb, var(--border) 70%, transparent)"
          />
          <PolarAngleAxis
            dataKey="axisLabel"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            axisLine={false}
            domain={[0, 100]}
            tick={false}
            tickCount={4}
          />
          <Radar
            dataKey="stableBand"
            fill="var(--color-stableBand)"
            fillOpacity={1}
            isAnimationActive={false}
            stroke="transparent"
          />
          <Radar
            dataKey="watchBand"
            fill="var(--color-watchBand)"
            fillOpacity={1}
            isAnimationActive={false}
            stroke="transparent"
          />
          <Radar
            dataKey="criticalBand"
            fill="var(--color-criticalBand)"
            fillOpacity={1}
            isAnimationActive={false}
            stroke="transparent"
          />
          <Radar
            dataKey="profile"
            fill="var(--color-profile)"
            fillOpacity={0.16}
            stroke="var(--color-profile)"
            strokeWidth={2.5}
          />
        </RadarChart>
      </ChartContainer>

      <div className="flex flex-wrap gap-2">
        <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
          Stable ring: 75 to 100
        </div>
        <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
          Watch ring: 55 to 74
        </div>
        <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
          Critical ring: 0 to 54
        </div>
      </div>
    </div>
  );
}
