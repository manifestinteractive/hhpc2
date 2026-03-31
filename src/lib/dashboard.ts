import type { TableEnum } from "@/lib/db";
import type {
  CrewDetailResponse,
  CrewOverviewItem,
  CrewSignalSnapshot,
  FleetTrendPoint,
  ReadinessScoreItem,
} from "@/types/api";

export type DashboardTone = "critical" | "stable" | "unknown" | "watch";

type BaselineProfile = Record<string, unknown>;

type SignalDeviationPoint = {
  baseline: number | null;
  confidenceScore: number;
  label: string;
  normalizedUnit: string;
  observed: number;
  signalType: CrewSignalSnapshot["signalType"];
  variancePercent: number;
};

export type ReadinessProfilePoint = {
  label: string;
  score: number;
};

function round(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatLabel(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(dateString));
}

export function getReadinessTone(score: number | null | undefined): DashboardTone {
  if (score == null) {
    return "unknown";
  }

  if (score < 55) {
    return "critical";
  }

  if (score < 75) {
    return "watch";
  }

  return "stable";
}

export function getSeverityTone(
  severity: TableEnum<"event_severity">,
): Exclude<DashboardTone, "unknown"> {
  if (severity === "high") {
    return "critical";
  }

  if (severity === "medium") {
    return "watch";
  }

  return "stable";
}

export function getReadinessLabel(tone: DashboardTone) {
  switch (tone) {
    case "critical":
      return "Critical";
    case "watch":
      return "Watch";
    case "stable":
      return "Stable";
    case "unknown":
      return "Unverified";
  }
}

const signalLabels: Record<CrewSignalSnapshot["signalType"], string> = {
  activity_level: "Activity",
  custom: "Custom",
  heart_rate: "Heart Rate",
  heart_rate_variability: "HRV",
  sleep_duration: "Sleep Duration",
  sleep_quality: "Sleep Quality",
  temperature: "Temperature",
};

export function getSignalLabel(signalType: CrewSignalSnapshot["signalType"]): string {
  return signalLabels[signalType];
}

export function sortCrewByRisk(crews: CrewOverviewItem[]) {
  return [...crews].sort((left, right) => {
    const leftScore =
      left.latestReadiness?.compositeScore ?? Number.POSITIVE_INFINITY;
    const rightScore =
      right.latestReadiness?.compositeScore ?? Number.POSITIVE_INFINITY;

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    if (left.recentEventCounts.high !== right.recentEventCounts.high) {
      return right.recentEventCounts.high - left.recentEventCounts.high;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

export function buildFleetTrend(scores: ReadinessScoreItem[]): FleetTrendPoint[] {
  const grouped = new Map<
    string,
    {
      minimumScore: number;
      scores: number[];
      timestamp: number;
    }
  >();

  for (const score of scores) {
    const current = grouped.get(score.calculatedAt);
    const timestamp = new Date(score.calculatedAt).getTime();

    if (!current) {
      grouped.set(score.calculatedAt, {
        minimumScore: score.compositeScore,
        scores: [score.compositeScore],
        timestamp,
      });
      continue;
    }

    current.minimumScore = Math.min(current.minimumScore, score.compositeScore);
    current.scores.push(score.compositeScore);
  }

  return [...grouped.entries()]
    .map(([dateString, group]) => ({
      averageScore: round(
        group.scores.reduce((sum, value) => sum + value, 0) /
          group.scores.length,
      ),
      label: formatLabel(dateString),
      minimumScore: round(group.minimumScore),
      timestamp: group.timestamp,
    }))
    .sort((left, right) => left.timestamp - right.timestamp);
}

function getBaselineValue(
  signalType: CrewSignalSnapshot["signalType"],
  baselineProfile: BaselineProfile,
): number | null {
  switch (signalType) {
    case "activity_level":
      return typeof baselineProfile.daily_activity_target === "number"
        ? baselineProfile.daily_activity_target
        : 0.5;
    case "heart_rate":
      return typeof baselineProfile.resting_heart_rate_bpm === "number"
        ? baselineProfile.resting_heart_rate_bpm
        : 60;
    case "heart_rate_variability":
      return typeof baselineProfile.heart_rate_variability_ms === "number"
        ? baselineProfile.heart_rate_variability_ms
        : 65;
    case "sleep_duration":
      return typeof baselineProfile.sleep_target_hours === "number"
        ? baselineProfile.sleep_target_hours
        : 7.5;
    case "sleep_quality":
      return typeof baselineProfile.sleep_quality_target === "number"
        ? baselineProfile.sleep_quality_target
        : 82;
    case "temperature":
      return typeof baselineProfile.baseline_body_temperature_c === "number"
        ? baselineProfile.baseline_body_temperature_c
        : 36.7;
    case "custom":
      return null;
    default:
      return null;
  }
}

export function buildSignalDeviationSeries(
  detail: CrewDetailResponse,
): SignalDeviationPoint[] {
  const baselineProfile =
    detail.crew.baselineProfile &&
    typeof detail.crew.baselineProfile === "object" &&
    !Array.isArray(detail.crew.baselineProfile)
      ? (detail.crew.baselineProfile as BaselineProfile)
      : {};

  return detail.signalSnapshots.map((snapshot) => {
    const baseline = getBaselineValue(snapshot.signalType, baselineProfile);
    const variancePercent =
      baseline && baseline !== 0
        ? round(((snapshot.normalizedValue - baseline) / baseline) * 100)
        : 0;

    return {
      baseline,
      confidenceScore: snapshot.confidenceScore,
      label: getSignalLabel(snapshot.signalType),
      normalizedUnit: snapshot.normalizedUnit,
      observed: snapshot.normalizedValue,
      signalType: snapshot.signalType,
      variancePercent,
    };
  });
}

function getNumericValue(value: unknown) {
  return typeof value === "number" ? value : null;
}

function getScoreComponentScore(scoreComponents: unknown, key: string) {
  if (!scoreComponents || typeof scoreComponents !== "object" || Array.isArray(scoreComponents)) {
    return null;
  }

  const component = (scoreComponents as Record<string, unknown>)[key];

  if (!component || typeof component !== "object" || Array.isArray(component)) {
    return null;
  }

  return getNumericValue((component as Record<string, unknown>).score);
}

function getEventPenalty(detail: CrewDetailResponse) {
  const scoreComponents = detail.latestReadiness?.scoreComponents;

  if (
    scoreComponents &&
    typeof scoreComponents === "object" &&
    !Array.isArray(scoreComponents)
  ) {
    const penalty = getNumericValue(
      (scoreComponents as Record<string, unknown>).event_penalty,
    );

    if (penalty != null) {
      return penalty;
    }
  }

  return detail.recentEvents.reduce((sum, event) => {
    switch (event.severity) {
      case "high":
        return sum + 14;
      case "medium":
        return sum + 8;
      case "low":
        return sum + 4;
    }
  }, 0);
}

export function buildReadinessProfile(detail: CrewDetailResponse): ReadinessProfilePoint[] {
  if (!detail.latestReadiness) {
    return [];
  }

  const scoreComponents = detail.latestReadiness?.scoreComponents;
  const cardiovascular = getScoreComponentScore(scoreComponents, "cardiovascular");
  const recovery = getScoreComponentScore(scoreComponents, "recovery");
  const thermalStability = getScoreComponentScore(scoreComponents, "thermal_stability");
  const activityBalance = getScoreComponentScore(scoreComponents, "activity_balance");
  const dataQuality = getScoreComponentScore(scoreComponents, "data_quality");
  const eventPenalty = clamp(getEventPenalty(detail), 0, 30);
  const eventBurden = round(100 - (eventPenalty / 30) * 100, 0);

  return [
    { label: "Cardiovascular", score: round(cardiovascular ?? 0, 0) },
    { label: "Recovery", score: round(recovery ?? 0, 0) },
    { label: "Thermal stability", score: round(thermalStability ?? 0, 0) },
    { label: "Activity balance", score: round(activityBalance ?? 0, 0) },
    { label: "Data quality", score: round(dataQuality ?? 0, 0) },
    { label: "Event burden", score: round(eventBurden, 0) },
  ];
}

export function getDominantFactors(detail: CrewDetailResponse) {
  const explanation =
    detail.latestReadiness?.scoreExplanation &&
    typeof detail.latestReadiness.scoreExplanation === "object" &&
    !Array.isArray(detail.latestReadiness.scoreExplanation)
      ? (detail.latestReadiness.scoreExplanation as Record<string, unknown>)
      : {};

  const dominantFactors = explanation.dominant_factors;

  if (!Array.isArray(dominantFactors)) {
    return [];
  }

  return dominantFactors.filter((item): item is string => typeof item === "string");
}

export function formatFactorLabel(factor: string) {
  return factor
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
