"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { EventListItem, ReadinessScoreItem } from "@/types/api";

const chartConfig = {
  compositeScore: {
    color: "var(--chart-1)",
    label: "Readiness",
  },
  confidencePercent: {
    color: "var(--chart-3)",
    label: "Confidence",
  },
} satisfies ChartConfig;

function getEventFill(severity: EventListItem["severity"]) {
  switch (severity) {
    case "high":
      return "var(--color-critical)";
    case "medium":
      return "var(--color-watch)";
    case "low":
      return "var(--color-stable)";
  }
}

function renderTooltipValue(value: unknown, label: string): ReactNode {
  return (
    <div className="flex flex-1 items-center justify-between gap-3 leading-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums text-foreground">
        {Math.round(Number(value))}
      </span>
    </div>
  );
}

export function ReadinessHistoryChart({
  events,
  scores,
}: {
  events: EventListItem[];
  scores: ReadinessScoreItem[];
}) {
  const data = [...scores]
    .sort(
      (left, right) =>
        new Date(left.calculatedAt).getTime() - new Date(right.calculatedAt).getTime(),
    )
    .map((score) => ({
      compositeScore: score.compositeScore,
      confidencePercent: Math.round(score.confidenceModifier * 100),
      label: new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
      }).format(new Date(score.calculatedAt)),
      shortLabel: new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(score.calculatedAt)),
      timestamp: new Date(score.calculatedAt).getTime(),
    }));

  if (data.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/50 px-6 text-center text-sm text-muted-foreground min-[1281px]:h-full min-[1281px]:min-h-0">
        Score history will appear after readiness scoring has produced at least one
        completed window for this crew member.
      </div>
    );
  }

  const hasSinglePoint = data.length === 1;

  const eventMarkers = events
    .map((event) => {
      const eventTimestamp = new Date(event.startedAt).getTime();
      const nearestPoint = data.reduce<(typeof data)[number] | null>((closest, point) => {
        if (!closest) {
          return point;
        }

        const currentDistance = Math.abs(point.timestamp - eventTimestamp);
        const bestDistance = Math.abs(closest.timestamp - eventTimestamp);

        return currentDistance < bestDistance ? point : closest;
      }, null);

      if (!nearestPoint) {
        return null;
      }

      return {
        eventType: event.eventType,
        severity: event.severity,
        xLabel: nearestPoint.shortLabel,
      };
    })
    .filter((marker): marker is NonNullable<typeof marker> => marker !== null);

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[280px] w-full min-[1281px]:h-full min-[1281px]:min-h-0 min-[1281px]:aspect-auto"
    >
      <LineChart accessibilityLayer data={data} margin={{ bottom: 8, left: 0, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="shortLabel"
          minTickGap={20}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          domain={[0, 105]}
          tickLine={false}
          tickMargin={8}
          width={32}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value, name) =>
                renderTooltipValue(
                  value,
                  name === "compositeScore" ? "Readiness" : "Confidence",
                )
              }
            />
          }
        />
        <ChartLegend
          content={(
            <ChartLegendContent className="flex-wrap justify-start gap-x-4 gap-y-2 pl-2 text-xs sm:justify-center" />
          )}
        />
        <Line
          dataKey="compositeScore"
          dot={
            hasSinglePoint
              ? {
                  fill: "var(--color-compositeScore)",
                  r: 5,
                  stroke: "var(--background)",
                  strokeWidth: 2,
                }
              : false
          }
          stroke="var(--color-compositeScore)"
          strokeWidth={3}
          type="monotone"
        />
        <Line
          dataKey="confidencePercent"
          dot={
            hasSinglePoint
              ? {
                  fill: "var(--color-confidencePercent)",
                  r: 5,
                  stroke: "var(--background)",
                  strokeWidth: 2,
                }
              : false
          }
          stroke="var(--color-confidencePercent)"
          strokeDasharray="5 4"
          strokeWidth={2}
          type="monotone"
        />
        {eventMarkers.map((marker, index) => (
          <ReferenceDot
            key={`${marker.eventType}-${marker.xLabel}-${index}`}
            fill={getEventFill(marker.severity)}
            r={5}
            stroke="var(--background)"
            strokeWidth={2}
            x={marker.xLabel}
            y={102}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
