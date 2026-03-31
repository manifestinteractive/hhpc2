"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import type { CrewTelemetryBundle } from "@/types/api";

type ThresholdTone = "critical" | "stable" | "watch";

type SignalThresholdBand = {
  from: number;
  to: number;
  tone: ThresholdTone;
};

type SignalThresholdConfig = {
  bands: SignalThresholdBand[];
  boundaries: number[];
};

const chartConfig = {
  value: {
    color: "var(--chart-1)",
    label: "Telemetry",
  },
} satisfies ChartConfig;

const MOBILE_TELEMETRY_POINT_LIMIT = 48;

const signalThresholds: Partial<
  Record<CrewTelemetryBundle["series"][number]["signalType"], SignalThresholdConfig>
> = {
  activity_level: {
    bands: [
      { from: 0, to: 0.35, tone: "critical" },
      { from: 0.35, to: 0.55, tone: "watch" },
      { from: 0.55, to: 1, tone: "stable" },
    ],
    boundaries: [0.35, 0.55],
  },
  heart_rate: {
    bands: [
      { from: 40, to: 50, tone: "critical" },
      { from: 50, to: 85, tone: "stable" },
      { from: 85, to: 100, tone: "watch" },
      { from: 100, to: 190, tone: "critical" },
    ],
    boundaries: [50, 85, 100],
  },
  heart_rate_variability: {
    bands: [
      { from: 12, to: 45, tone: "critical" },
      { from: 45, to: 60, tone: "watch" },
      { from: 60, to: 140, tone: "stable" },
    ],
    boundaries: [45, 60],
  },
  sleep_duration: {
    bands: [
      { from: 0, to: 6, tone: "critical" },
      { from: 6, to: 7, tone: "watch" },
      { from: 7, to: 12, tone: "stable" },
    ],
    boundaries: [6, 7],
  },
  sleep_quality: {
    bands: [
      { from: 0, to: 65, tone: "critical" },
      { from: 65, to: 80, tone: "watch" },
      { from: 80, to: 100, tone: "stable" },
    ],
    boundaries: [65, 80],
  },
  temperature: {
    bands: [
      { from: 35.5, to: 35.8, tone: "critical" },
      { from: 35.8, to: 36.1, tone: "watch" },
      { from: 36.1, to: 37.5, tone: "stable" },
      { from: 37.5, to: 38, tone: "watch" },
      { from: 38, to: 38.8, tone: "critical" },
    ],
    boundaries: [35.8, 36.1, 37.5, 38],
  },
};

function getThresholdColor(tone: ThresholdTone) {
  switch (tone) {
    case "critical":
      return "var(--color-critical)";
    case "watch":
      return "var(--color-watch)";
    case "stable":
      return "var(--color-stable)";
  }
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatShortTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPaddedDomain(values: number[]) {
  if (values.length === 0) {
    return [0, 1] as const;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  if (span === 0) {
    const magnitude = Math.max(Math.abs(min), 1);
    const padding =
      magnitude >= 10 ? 0.08 : magnitude >= 1 ? 0.05 : 0.03;
    return [min - padding, max + padding] as const;
  }

  const minimumPadding =
    span <= 0.25 ? 0.02 : span <= 1 ? 0.04 : span <= 5 ? 0.08 : 0.12;
  const padding = Math.max(span * 0.12, minimumPadding);
  return [min - padding, max + padding] as const;
}

function getVisibleThresholdBands(
  thresholdConfig: SignalThresholdConfig | undefined,
  domain: readonly [number, number],
) {
  if (!thresholdConfig) {
    return [];
  }

  return thresholdConfig.bands.flatMap((band) => {
    const from = Math.max(domain[0], band.from);
    const to = Math.min(domain[1], band.to);

    if (to <= from) {
      return [];
    }

    return [{ ...band, from, to }];
  });
}

function getVisibleThresholdLines(
  thresholdConfig: SignalThresholdConfig | undefined,
  domain: readonly [number, number],
) {
  if (!thresholdConfig) {
    return [];
  }

  return thresholdConfig.boundaries.filter(
    (boundary) => boundary > domain[0] && boundary < domain[1],
  );
}

function formatYAxisTick(value: number, domain: readonly [number, number]) {
  const span = Math.abs(domain[1] - domain[0]);

  if (span <= 1) {
    return value.toFixed(2);
  }

  if (span <= 10) {
    return value.toFixed(1);
  }

  return `${Math.round(value)}`;
}

function AnimatedTelemetryValue({
  children,
  valueKey,
}: {
  children: ReactNode;
  valueKey: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={valueKey}
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        exit={{ opacity: 0, y: -10 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function renderTelemetryTooltipValue(input: {
  label: string;
  normalizedUnit: string;
  value: unknown;
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3 leading-none">
      <span className="text-muted-foreground">{input.label}</span>
      <span className="font-mono font-medium tabular-nums text-foreground">
        {Number(input.value).toFixed(2)} {input.normalizedUnit}
      </span>
    </div>
  );
}

export function LiveTelemetryChart({
  telemetry,
}: {
  telemetry: CrewTelemetryBundle | null;
}) {
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [chartRenderSeed, setChartRenderSeed] = useState(0);
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setChartRenderSeed(1);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateViewport = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  if (!telemetry || telemetry.series.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/60 px-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Live telemetry appears after processing completes
        </p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Trigger a simulation cycle to generate fresh normalized signal traces for
          the focused crew member.
        </p>
      </div>
    );
  }

  const activeSeries =
    telemetry.series.find((series) => series.signalType === selectedSignal) ??
    telemetry.series[0];

  const latestPoint = activeSeries.points[activeSeries.points.length - 1] ?? null;
  const visiblePoints =
    isCompactViewport && activeSeries.points.length > MOBILE_TELEMETRY_POINT_LIMIT
      ? activeSeries.points.slice(-MOBILE_TELEMETRY_POINT_LIMIT)
      : activeSeries.points;
  const data = visiblePoints.map((point) => ({
    capturedAt: point.capturedAt,
    confidenceScore: point.confidenceScore,
    label: formatTimestamp(point.capturedAt),
    shortLabel: formatShortTimestamp(point.capturedAt),
    value: Number(point.normalizedValue.toFixed(2)),
  }));
  const yAxisDomain = getPaddedDomain(data.map((point) => point.value));
  const thresholdConfig = signalThresholds[activeSeries.signalType];
  const visibleThresholdBands = getVisibleThresholdBands(
    thresholdConfig,
    yAxisDomain,
  );
  const visibleThresholdLines = getVisibleThresholdLines(
    thresholdConfig,
    yAxisDomain,
  );

  return (
    <div className="space-y-5 min-[1281px]:flex min-[1281px]:h-full min-[1281px]:flex-col">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {telemetry.series.map((series) => (
            <Button
              key={series.signalType}
              className="h-auto rounded-full px-3 py-2 text-[11px] leading-tight sm:px-4 sm:text-xs"
              onClick={() => setSelectedSignal(series.signalType)}
              size="sm"
              variant={series.signalType === activeSeries.signalType ? "default" : "outline"}
            >
              {series.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        <div className="hidden rounded-2xl border border-border/70 bg-background/80 px-4 py-4 md:block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Current signal
          </div>
          <div className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
            <AnimatedTelemetryValue valueKey={activeSeries.signalType}>
              <span>{activeSeries.label}</span>
            </AnimatedTelemetryValue>
          </div>
        </div>
        <div className="hidden rounded-2xl border border-border/70 bg-background/80 px-4 py-4 md:block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Latest value
          </div>
          <div className="mt-2 min-w-0 break-words text-xl font-semibold text-foreground tabular-nums sm:text-2xl">
            {latestPoint ? (
              <AnimatedTelemetryValue
                valueKey={`${activeSeries.signalType}-${latestPoint.capturedAt}-value`}
              >
                <span>
                  <AnimatedNumber
                    decimals={2}
                    value={latestPoint.normalizedValue}
                  />{" "}
                  {activeSeries.normalizedUnit}
                </span>
              </AnimatedTelemetryValue>
            ) : (
              "N/A"
            )}
          </div>
        </div>
        <div className="hidden rounded-2xl border border-border/70 bg-background/80 px-4 py-4 md:block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Signal confidence
          </div>
          <div className="mt-2 text-xl font-semibold text-foreground tabular-nums sm:text-2xl">
            {latestPoint ? (
              <AnimatedTelemetryValue
                valueKey={`${activeSeries.signalType}-${latestPoint.capturedAt}-confidence`}
              >
                <AnimatedNumber
                  suffix="%"
                  value={Math.round(latestPoint.confidenceScore * 100)}
                />
              </AnimatedTelemetryValue>
            ) : (
              "N/A"
            )}
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 md:hidden">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Signal confidence
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {latestPoint ? (
            <AnimatedTelemetryValue
              valueKey={`${activeSeries.signalType}-${latestPoint.capturedAt}-confidence-inline`}
            >
              <AnimatedNumber
                suffix="%"
                value={Math.round(latestPoint.confidenceScore * 100)}
              />
            </AnimatedTelemetryValue>
          ) : (
            "N/A"
          )}
        </span>
      </div>

      <ChartContainer
        config={chartConfig}
        className="min-h-[280px] w-full min-[1281px]:min-h-0 min-[1281px]:flex-1 min-[1281px]:aspect-auto"
      >
        <LineChart
          key={`${activeSeries.signalType}-${chartRenderSeed}`}
          accessibilityLayer
          data={data}
          margin={{ bottom: 8, left: 0, right: 8 }}
        >
          {visibleThresholdBands.map((band) => (
            <ReferenceArea
              key={`${activeSeries.signalType}-${band.tone}-${band.from}-${band.to}`}
              fill={getThresholdColor(band.tone)}
              fillOpacity={0.12}
              ifOverflow="extendDomain"
              strokeOpacity={0}
              y1={band.from}
              y2={band.to}
            />
          ))}
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey={isCompactViewport ? "shortLabel" : "label"}
            minTickGap={isCompactViewport ? 20 : 28}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            domain={yAxisDomain}
            tickLine={false}
            tickMargin={8}
            width={44}
            tickFormatter={(value) =>
              formatYAxisTick(Number(value), yAxisDomain)
            }
          />
          {visibleThresholdLines.map((boundary) => (
            <ReferenceLine
              key={`${activeSeries.signalType}-threshold-${boundary}`}
              ifOverflow="extendDomain"
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.35}
              strokeWidth={1}
              y={boundary}
            />
          ))}
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.label ?? "Telemetry point"
                }
                formatter={(value) =>
                  renderTelemetryTooltipValue({
                    label: activeSeries.label,
                    normalizedUnit: activeSeries.normalizedUnit,
                    value,
                  })
                }
              />
            }
          />
          <Line
            dataKey="value"
            dot={false}
            stroke="var(--color-value)"
            strokeWidth={isCompactViewport ? 2.5 : 3}
            type="monotone"
          />
        </LineChart>
      </ChartContainer>

      {isCompactViewport && activeSeries.points.length > MOBILE_TELEMETRY_POINT_LIMIT ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Showing the latest {MOBILE_TELEMETRY_POINT_LIMIT} samples on mobile.
        </p>
      ) : null}
    </div>
  );
}
