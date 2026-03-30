"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getReadinessTone } from "@/lib/dashboard";
import type { CrewOverviewItem } from "@/types/api";

const chartConfig = {
  readiness: {
    color: "var(--chart-1)",
    label: "Readiness",
  },
} satisfies ChartConfig;

function getFill(score: number | null | undefined) {
  switch (getReadinessTone(score)) {
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

export function CrewReadinessChart({
  crews,
}: {
  crews: CrewOverviewItem[];
}) {
  const data = crews.map((crew) => ({
    crew: crew.callSign ?? crew.crewCode,
    displayName: crew.displayName,
    readiness: crew.latestReadiness?.compositeScore ?? 0,
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[260px] w-full min-[1281px]:min-h-[220px]"
    >
      <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="crew"
          tickLine={false}
          tickMargin={10}
        />
        <YAxis
          axisLine={false}
          domain={[0, 100]}
          tickLine={false}
          tickMargin={10}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.displayName ?? "Crew"
              }
              formatter={(value) => [
                `${Math.round(Number(value))}`,
                "Readiness",
              ]}
            />
          }
        />
        <Bar dataKey="readiness" radius={8}>
          {data.map((row) => (
            <Cell key={row.crew} fill={getFill(row.readiness)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
