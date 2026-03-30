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
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getReadinessLabel, getReadinessTone, type ReadinessProfilePoint } from "@/lib/dashboard";

const chartConfig = {
  criticalBand: {
    color: "color-mix(in srgb, var(--color-critical) 14%, transparent)",
    label: "Critical band",
  },
  profile: {
    color: "var(--foreground)",
    label: "Readiness profile",
  },
  stableBand: {
    color: "color-mix(in srgb, var(--color-stable) 10%, transparent)",
    label: "Stable band",
  },
  watchBand: {
    color: "color-mix(in srgb, var(--color-watch) 12%, transparent)",
    label: "Watch band",
  },
} satisfies ChartConfig;

function formatTone(score: number) {
  const tone = getReadinessTone(score);
  return getReadinessLabel(tone);
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
        className="min-h-[340px] w-full min-[1281px]:h-full min-[1281px]:min-h-0 min-[1281px]:aspect-auto"
      >
        <RadarChart
          accessibilityLayer
          cx="50%"
          cy="50%"
          data={chartData}
          margin={{ bottom: 8, left: 24, right: 24, top: 8 }}
          outerRadius="72%"
        >
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(_, __, item) => {
                  const payload = item?.payload as
                    | {
                        label: string;
                        score: number;
                      }
                    | undefined;

                  if (!payload) {
                    return null;
                  }

                  return (
                    <div className="grid gap-1.5">
                      <div className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
                        {payload.label}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Readiness</span>
                        <span className="font-mono tabular-nums">
                          {Math.round(payload.score)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Status band</span>
                        <span>{formatTone(payload.score)}</span>
                      </div>
                    </div>
                  );
                }}
                hideIndicator
                labelFormatter={() => ""}
              />
            }
            cursor={false}
          />
          <PolarGrid
            gridType="polygon"
            radialLines={false}
            stroke="color-mix(in srgb, var(--border) 70%, transparent)"
          />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            axisLine={false}
            domain={[0, 100]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
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
