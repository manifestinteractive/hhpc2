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
  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[320px] w-full min-[1281px]:h-full min-[1281px]:min-h-0 min-[1281px]:aspect-auto"
    >
      <BarChart accessibilityLayer data={points} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis
          axisLine={false}
          domain={[-60, 60]}
          tickLine={false}
          tickMargin={10}
          type="number"
        />
        <YAxis
          axisLine={false}
          dataKey="label"
          tickLine={false}
          tickMargin={12}
          type="category"
          width={104}
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
          {points.map((point) => (
            <Cell key={point.label} fill={getFill(point.variancePercent)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
