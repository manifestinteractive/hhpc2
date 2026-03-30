"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  averageScore: {
    color: "var(--chart-1)",
    label: "Fleet average",
  },
  minimumScore: {
    color: "var(--chart-5)",
    label: "Lowest crew score",
  },
} satisfies ChartConfig;

function getPaddedDomain(points: {
  averageScore: number;
  minimumScore: number;
}[]) {
  const values = points.flatMap((point) => [point.averageScore, point.minimumScore]);

  if (values.length === 0) {
    return [0, 100] as const;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.08, 2);
    return [Math.max(0, min - padding), Math.min(100, max + padding)] as const;
  }

  const padding = Math.max((max - min) * 0.18, 3);
  return [
    Math.max(0, min - padding),
    Math.min(100, max + padding),
  ] as const;
}

function formatYAxisTick(value: number, domainMax: number) {
  if (domainMax > 1) {
    return `${Math.round(value)}`;
  }

  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}

export function FleetReadinessTrendChart({
  points,
}: {
  points: {
    averageScore: number;
    label: string;
    minimumScore: number;
    timestamp: number;
  }[];
}) {
  const yAxisDomain = getPaddedDomain(points);

  if (points.length < 2) {
    const latestPoint = points[0] ?? null;

    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/60 px-6 text-center min-[1281px]:min-h-[220px]">
        <p className="text-sm font-medium text-foreground">
          Trend line pending more scoring windows
        </p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          A fleet trend becomes meaningful after at least two readiness snapshots.
          Run another simulation window to compare movement over time.
        </p>
        {latestPoint ? (
          <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em]">
                Fleet average
              </div>
              <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                {Math.round(latestPoint.averageScore)}
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em]">
                Lowest crew
              </div>
              <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                {Math.round(latestPoint.minimumScore)}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="h-[320px] w-full justify-start min-[1281px]:h-[220px]"
    >
      <LineChart accessibilityLayer data={points} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          minTickGap={28}
          tickLine={false}
          tickMargin={10}
        />
        <YAxis
          axisLine={false}
          domain={yAxisDomain}
          tickLine={false}
          tickMargin={10}
          tickFormatter={(value) => formatYAxisTick(Number(value), yAxisDomain[1])}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="averageScore"
          dot={false}
          stroke="var(--color-averageScore)"
          strokeWidth={3}
          type="monotone"
        />
        <Line
          dataKey="minimumScore"
          dot={false}
          stroke="var(--color-minimumScore)"
          strokeDasharray="5 4"
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}
