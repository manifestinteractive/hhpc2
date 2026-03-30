"use client";

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
      timestamp: new Date(score.calculatedAt).getTime(),
    }));

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
        xLabel: nearestPoint.label,
      };
    })
    .filter((marker): marker is NonNullable<typeof marker> => marker !== null);

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[340px] w-full min-[1281px]:h-full min-[1281px]:min-h-0 min-[1281px]:aspect-auto"
    >
      <LineChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
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
          domain={[0, 105]}
          tickLine={false}
          tickMargin={10}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value, name) => [
                `${Math.round(Number(value))}`,
                name === "compositeScore" ? "Readiness" : "Confidence",
              ]}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="compositeScore"
          dot={false}
          stroke="var(--color-compositeScore)"
          strokeWidth={3}
          type="monotone"
        />
        <Line
          dataKey="confidencePercent"
          dot={false}
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
