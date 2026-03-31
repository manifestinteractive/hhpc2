"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getReadinessTone } from "@/lib/dashboard";

const chartConfig = {
  variancePercent: {
    color: "var(--chart-2)",
    label: "Deviation vs baseline",
  },
} satisfies ChartConfig;

function getDomain(points: { variancePercent: number }[]) {
  const maxAbsVariance = Math.max(
    ...points.map((point) => Math.abs(point.variancePercent)),
  );
  const domainMax = Math.min(
    Math.max(Math.ceil(maxAbsVariance / 10) * 10, 20),
    60,
  );

  return [-domainMax, domainMax] as const;
}

function getFill(value: number) {
  const scoreEquivalent = 100 - Math.min(Math.abs(value), 100);

  switch (getReadinessTone(scoreEquivalent)) {
    case "critical":
      return "var(--color-critical)";
    case "watch":
      return "var(--color-watch)";
    case "stable":
      return "var(--color-stable)";
    case "unknown":
      return "var(--color-unknown)";
  }
}

function formatSignalAxisLabel(label: string) {
  switch (label) {
    case "Heart Rate":
      return "Heart";
    case "Sleep Duration":
      return "Sleep";
    case "Sleep Quality":
      return "Quality";
    default:
      return label;
  }
}

export function SignalDeviationChart({
  points,
}: {
  points: {
    baseline: number | null;
    confidenceScore: number;
    label: string;
    normalizedUnit: string;
    observed: number;
    variancePercent: number;
  }[];
}) {
  if (points.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/50 px-6 text-center text-sm text-muted-foreground min-[1281px]:h-full min-[1281px]:min-h-0">
        Signal shifts become available once baseline-aware telemetry has been
        processed for this crew member.
      </div>
    );
  }

  const domain = getDomain(points);
  const chartData = points.map((point) => ({
    ...point,
    shortLabel: formatSignalAxisLabel(point.label),
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[280px] w-full min-[1281px]:h-full min-[1281px]:min-h-0 min-[1281px]:aspect-auto"
    >
      <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
        <CartesianGrid horizontal={false} />
        <XAxis
          axisLine={false}
          domain={domain}
          tickLine={false}
          tickMargin={8}
          type="number"
        />
        <YAxis
          axisLine={false}
          dataKey="shortLabel"
          tickLine={false}
          tickMargin={8}
          type="category"
          width={84}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(_, __, item) => {
                const payload = item?.payload as
                  | {
                      baseline: number | null;
                      normalizedUnit: string;
                      observed: number;
                      variancePercent: number;
                    }
                  | undefined;

                if (!payload) {
                  return null;
                }

                return (
                  <div className="grid gap-1.5">
                    <div className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
                      Signal state
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Observed</span>
                      <span className="font-mono tabular-nums">
                        {payload.observed.toFixed(1)} {payload.normalizedUnit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Baseline</span>
                      <span className="font-mono tabular-nums">
                        {payload.baseline != null
                          ? `${payload.baseline.toFixed(1)} ${payload.normalizedUnit}`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Variance</span>
                      <span className="font-mono tabular-nums">
                        {payload.variancePercent > 0 ? "+" : ""}
                        {payload.variancePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              }}
              hideIndicator
              labelFormatter={(label) => label}
            />
          }
        />
        <Bar dataKey="variancePercent" radius={8}>
          {chartData.map((point) => (
            <Cell key={point.label} fill={getFill(point.variancePercent)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
