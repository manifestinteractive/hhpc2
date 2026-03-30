import { z } from "zod";
import {
  chunkValues,
  createSupabaseServiceRoleClient,
  fetchAllPages,
  systemLogsRepository,
  type DatabaseClient,
  type Json,
  type TableEnum,
  type TableInsert,
  type TableRow,
} from "@/lib/db";
import {
  DEFAULT_EVENT_RULE_VERSION,
} from "@/lib/processing/events";
import { DEFAULT_NORMALIZATION_VERSION } from "@/lib/processing/normalization";

export const DEFAULT_SCORE_VERSION = "v1";

export type ReadinessScoringResult = {
  crewMemberCount: number;
  ingestionRunId: number;
  normalizationVersion: string;
  ruleVersion: string;
  scoreCount: number;
  scoreVersion: string;
};

type ReadinessScoringRequest = {
  ingestionRunId: number;
  normalizationVersion: string;
  ruleVersion: string;
  scoreVersion: string;
};

type BaselineProfile = Record<string, Json | undefined>;

type NormalizedReadingForScoring = Pick<
  TableRow<"normalized_readings">,
  | "captured_at"
  | "confidence_score"
  | "crew_member_id"
  | "id"
  | "normalized_value"
  | "processing_metadata"
  | "raw_reading_id"
  | "signal_type"
>;

type DetectedEventForScoring = Pick<
  TableRow<"detected_events">,
  | "confidence_score"
  | "crew_member_id"
  | "event_type"
  | "primary_signal_type"
  | "rule_version"
  | "severity"
  | "started_at"
>;

type ScoreComponent = {
  baseline?: number;
  observed?: number;
  score: number;
  weight: number;
};

type CrewReadinessComputation = {
  confidenceModifier: number;
  score: number;
  scoreComponents: Record<string, Json>;
  scoreExplanation: Record<string, Json>;
  windowEndedAt: string;
  windowStartedAt: string;
};

export class ReadinessScoringError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ReadinessScoringError";
  }
}

const readinessScoringRequestSchema = z.object({
  ingestionRunId: z.number().int().positive(),
  normalizationVersion: z
    .string()
    .trim()
    .min(1)
    .default(DEFAULT_NORMALIZATION_VERSION),
  ruleVersion: z.string().trim().min(1).default(DEFAULT_EVENT_RULE_VERSION),
  scoreVersion: z.string().trim().min(1).default(DEFAULT_SCORE_VERSION),
});

const componentWeights = {
  activityBalance: 0.15,
  cardiovascular: 0.35,
  dataQuality: 0.1,
  recovery: 0.3,
  thermalStability: 0.1,
} as const;

function asObject(value: Json): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getBaselineNumber(
  baselineProfile: BaselineProfile,
  key: string,
  fallback: number,
) {
  const value = baselineProfile[key];
  return typeof value === "number" ? value : fallback;
}

function getLatestReadingBySignal(
  readings: NormalizedReadingForScoring[],
  signalType: TableEnum<"signal_type">,
) {
  const matches = readings.filter((reading) => reading.signal_type === signalType);
  return matches[matches.length - 1] ?? null;
}

function getComponentScore(
  baseline: number,
  observed: number,
  options: {
    maxPenaltyDelta: number;
    severity: "higher-is-worse" | "lower-is-worse" | "distance";
  },
) {
  let ratio: number;

  if (options.severity === "higher-is-worse") {
    ratio = clamp((observed - baseline) / options.maxPenaltyDelta, 0, 1);
  } else if (options.severity === "lower-is-worse") {
    ratio = clamp((baseline - observed) / options.maxPenaltyDelta, 0, 1);
  } else {
    ratio = clamp(Math.abs(observed - baseline) / options.maxPenaltyDelta, 0, 1);
  }

  return clamp(round(100 - ratio * 100), 0, 100);
}

function getReliabilityIndicators(readings: NormalizedReadingForScoring[]) {
  const lowConfidenceCount = readings.filter((reading) => reading.confidence_score < 0.75).length;
  const imputedCount = readings.filter((reading) => {
    const metadata = asObject(reading.processing_metadata);
    return Array.isArray(metadata.quality_flags) && metadata.quality_flags.includes("imputed");
  }).length;

  return {
    imputedRatio: readings.length === 0 ? 0 : imputedCount / readings.length,
    lowConfidenceRatio: readings.length === 0 ? 0 : lowConfidenceCount / readings.length,
    meanConfidence: readings.length === 0 ? 1 : average(readings.map((reading) => reading.confidence_score)),
  };
}

function summarizeEvents(events: DetectedEventForScoring[]) {
  const countsBySeverity: Record<TableEnum<"event_severity">, number> = {
    high: 0,
    low: 0,
    medium: 0,
  };
  const countsByType = new Map<string, number>();

  for (const event of events) {
    countsBySeverity[event.severity] += 1;
    countsByType.set(event.event_type, (countsByType.get(event.event_type) ?? 0) + 1);
  }

  return {
    countsBySeverity,
    countsByType: Object.fromEntries([...countsByType.entries()].sort()),
  };
}

export function computeCrewReadinessScore(
  readings: NormalizedReadingForScoring[],
  events: DetectedEventForScoring[],
  baselineProfile: BaselineProfile,
): CrewReadinessComputation {
  if (readings.length === 0) {
    throw new ReadinessScoringError("Cannot score a crew member without normalized readings.", 422);
  }

  const sortedReadings = [...readings].sort((left, right) =>
    left.captured_at.localeCompare(right.captured_at),
  );
  const firstReading = sortedReadings[0]!;
  const lastReading = sortedReadings[sortedReadings.length - 1]!;
  const latestHeartRate = getLatestReadingBySignal(sortedReadings, "heart_rate");
  const latestHrv = getLatestReadingBySignal(sortedReadings, "heart_rate_variability");
  const latestActivity = getLatestReadingBySignal(sortedReadings, "activity_level");
  const latestTemperature = getLatestReadingBySignal(sortedReadings, "temperature");
  const latestSleepDuration = getLatestReadingBySignal(sortedReadings, "sleep_duration");
  const latestSleepQuality = getLatestReadingBySignal(sortedReadings, "sleep_quality");

  const hrBaseline = getBaselineNumber(baselineProfile, "resting_heart_rate_bpm", 60);
  const hrvBaseline = getBaselineNumber(baselineProfile, "heart_rate_variability_ms", 65);
  const activityBaseline = getBaselineNumber(baselineProfile, "daily_activity_target", 0.5);
  const temperatureBaseline = getBaselineNumber(
    baselineProfile,
    "baseline_body_temperature_c",
    36.7,
  );
  const sleepDurationBaseline = getBaselineNumber(
    baselineProfile,
    "sleep_target_hours",
    7.5,
  );
  const sleepQualityBaseline = getBaselineNumber(
    baselineProfile,
    "sleep_quality_target",
    82,
  );

  const cardiovascularScore = round(
    average([
      latestHeartRate
        ? getComponentScore(hrBaseline, Number(latestHeartRate.normalized_value), {
            maxPenaltyDelta: hrBaseline * 0.35,
            severity: "higher-is-worse",
          })
        : 100,
      latestHrv
        ? getComponentScore(hrvBaseline, Number(latestHrv.normalized_value), {
            maxPenaltyDelta: hrvBaseline * 0.45,
            severity: "lower-is-worse",
          })
        : 100,
    ]),
  );

  const recoveryScore = round(
    average([
      latestSleepDuration
        ? getComponentScore(sleepDurationBaseline, Number(latestSleepDuration.normalized_value), {
            maxPenaltyDelta: sleepDurationBaseline * 0.4,
            severity: "lower-is-worse",
          })
        : 100,
      latestSleepQuality
        ? getComponentScore(sleepQualityBaseline, Number(latestSleepQuality.normalized_value), {
            maxPenaltyDelta: sleepQualityBaseline * 0.35,
            severity: "lower-is-worse",
          })
        : 100,
    ]),
  );

  const activityBalanceScore = latestActivity
    ? getComponentScore(activityBaseline, Number(latestActivity.normalized_value), {
        maxPenaltyDelta: Math.max(activityBaseline * 0.8, 0.25),
        severity: "lower-is-worse",
      })
    : 100;
  const thermalStabilityScore = latestTemperature
    ? getComponentScore(temperatureBaseline, Number(latestTemperature.normalized_value), {
        maxPenaltyDelta: 1.2,
        severity: "distance",
      })
    : 100;

  const reliability = getReliabilityIndicators(sortedReadings);
  const dataQualityScore = clamp(
    round(
      reliability.meanConfidence * 100 -
        reliability.imputedRatio * 15 -
        reliability.lowConfidenceRatio * 20,
    ),
    0,
    100,
  );

  const components: Record<string, ScoreComponent> = {
    activity_balance: {
      baseline: activityBaseline,
      observed: latestActivity ? Number(latestActivity.normalized_value) : undefined,
      score: activityBalanceScore,
      weight: componentWeights.activityBalance,
    },
    cardiovascular: {
      baseline: hrBaseline,
      observed: latestHeartRate ? Number(latestHeartRate.normalized_value) : undefined,
      score: cardiovascularScore,
      weight: componentWeights.cardiovascular,
    },
    data_quality: {
      observed: round(reliability.meanConfidence, 4),
      score: dataQualityScore,
      weight: componentWeights.dataQuality,
    },
    recovery: {
      baseline: sleepDurationBaseline,
      observed: latestSleepDuration ? Number(latestSleepDuration.normalized_value) : undefined,
      score: recoveryScore,
      weight: componentWeights.recovery,
    },
    thermal_stability: {
      baseline: temperatureBaseline,
      observed: latestTemperature ? Number(latestTemperature.normalized_value) : undefined,
      score: thermalStabilityScore,
      weight: componentWeights.thermalStability,
    },
  };

  const weightedScore = round(
    Object.values(components).reduce(
      (sum, component) => sum + component.score * component.weight,
      0,
    ),
  );

  const eventPenalty = clamp(
    round(
      events.reduce((sum, event) => {
        switch (event.severity) {
          case "high":
            return sum + 14;
          case "medium":
            return sum + 8;
          case "low":
            return sum + 4;
        }
      }, 0),
    ),
    0,
    30,
  );

  const reliabilityEventCount = events.filter(
    (event) => event.event_type === "sensor_reliability_issue",
  ).length;
  const confidenceModifier = clamp(
    round(
      reliability.meanConfidence -
        reliability.imputedRatio * 0.12 -
        reliability.lowConfidenceRatio * 0.12 -
        reliabilityEventCount * 0.03,
      4,
    ),
    0.55,
    1,
  );
  const scoreBeforeConfidence = clamp(weightedScore - eventPenalty, 0, 100);
  const finalScore = clamp(
    round(scoreBeforeConfidence * (0.75 + confidenceModifier * 0.25)),
    0,
    100,
  );
  const eventSummary = summarizeEvents(events);

  return {
    confidenceModifier,
    score: finalScore,
    scoreComponents: {
      ...Object.fromEntries(
        Object.entries(components).map(([key, component]) => [key, component as Json]),
      ),
      event_penalty: eventPenalty,
      weighted_score: weightedScore,
    },
    scoreExplanation: {
      confidence_modifier: confidenceModifier,
      counts_by_event_type: eventSummary.countsByType as Json,
      counts_by_severity: eventSummary.countsBySeverity as Json,
      dominant_factors: Object.entries(components)
        .sort((left, right) => left[1].score - right[1].score)
        .slice(0, 3)
        .map(([key]) => key) as Json,
      event_penalty: eventPenalty,
      score_before_confidence: scoreBeforeConfidence,
    },
    windowEndedAt: lastReading.captured_at,
    windowStartedAt: firstReading.captured_at,
  };
}

async function logReadinessScoring(
  client: DatabaseClient,
  eventType: string,
  level: TableEnum<"system_log_level">,
  message: string,
  relatedRecordId: number,
  details: Record<string, unknown>,
) {
  await systemLogsRepository.create(client, {
    component: "processing",
    details: details as Json,
    event_type: eventType,
    level,
    message,
    related_record_id: relatedRecordId,
    related_table_name: "ingestion_runs",
  });
}

export async function calculateReadinessScoresForIngestionRun(
  client: DatabaseClient,
  request: ReadinessScoringRequest,
): Promise<ReadinessScoringResult> {
  await logReadinessScoring(
    client,
    "readiness-scoring-started",
    "info",
    `Started readiness scoring for ingestion run ${request.ingestionRunId}.`,
    request.ingestionRunId,
    {
      normalization_version: request.normalizationVersion,
      rule_version: request.ruleVersion,
      score_version: request.scoreVersion,
    },
  );

  try {
    const rawReadings = await fetchAllPages<{ id: number }>(
      async (from, to) =>
        client
          .from("raw_readings")
          .select("id")
          .eq("ingestion_run_id", request.ingestionRunId)
          .order("id", { ascending: true })
          .range(from, to),
    );
    const rawReadingIds = rawReadings.map((row) => row.id);

    if (rawReadingIds.length === 0) {
      throw new ReadinessScoringError(
        `Ingestion run ${request.ingestionRunId} has no raw readings to score.`,
        422,
      );
    }

    const normalizedReadings = (
      await Promise.all(
        chunkValues(rawReadingIds).map(async (rawReadingIdChunk) => {
          const result = await client
            .from("normalized_readings")
            .select(
              "id, crew_member_id, raw_reading_id, captured_at, signal_type, normalized_value, confidence_score, processing_metadata",
            )
            .eq("normalization_version", request.normalizationVersion)
            .in("raw_reading_id", rawReadingIdChunk)
            .order("crew_member_id", { ascending: true })
            .order("captured_at", { ascending: true })
            .order("id", { ascending: true });

          if (result.error) {
            throw new Error(
              `[normalized_readings] select failed: ${result.error.message}`,
            );
          }

          return (result.data ?? []) as NormalizedReadingForScoring[];
        }),
      )
    )
      .flat()
      .sort((left, right) => {
        if (left.crew_member_id !== right.crew_member_id) {
          return left.crew_member_id - right.crew_member_id;
        }

        if (left.captured_at !== right.captured_at) {
          return left.captured_at.localeCompare(right.captured_at);
        }

        return left.id - right.id;
      });

    if (normalizedReadings.length === 0) {
      throw new ReadinessScoringError(
        `Ingestion run ${request.ingestionRunId} has no normalized readings for version ${request.normalizationVersion}.`,
        422,
      );
    }

    const normalizedIds = normalizedReadings.map((reading) => reading.id);
    const detectedEvents = (
      await Promise.all(
        chunkValues(normalizedIds).map(async (normalizedIdChunk) => {
          const result = await client
            .from("detected_events")
            .select(
              "crew_member_id, event_type, severity, confidence_score, primary_signal_type, rule_version, started_at",
            )
            .eq("rule_version", request.ruleVersion)
            .in("normalized_reading_id", normalizedIdChunk)
            .order("started_at", { ascending: true });

          if (result.error) {
            throw new Error(
              `[detected_events] select failed: ${result.error.message}`,
            );
          }

          return (result.data ?? []) as DetectedEventForScoring[];
        }),
      )
    )
      .flat()
      .sort((left, right) => left.started_at.localeCompare(right.started_at));
    const crewMemberIds = [...new Set(normalizedReadings.map((reading) => reading.crew_member_id))];
    const crewMembersResult = await client
      .from("crew_members")
      .select("id, baseline_profile")
      .in("id", crewMemberIds);

    if (crewMembersResult.error) {
      throw new Error(`[crew_members] select failed: ${crewMembersResult.error.message}`);
    }

    const baselineByCrewMember = new Map(
      (crewMembersResult.data ?? []).map((crewMember) => [
        crewMember.id,
        asObject(crewMember.baseline_profile),
      ]),
    );
    const readinessRows: TableInsert<"readiness_scores">[] = [];

    for (const crewMemberId of crewMemberIds) {
      const crewReadings = normalizedReadings.filter(
        (reading) => reading.crew_member_id === crewMemberId,
      );
      const crewEvents = detectedEvents.filter((event) => event.crew_member_id === crewMemberId);
      const readiness = computeCrewReadinessScore(
        crewReadings,
        crewEvents,
        baselineByCrewMember.get(crewMemberId) ?? {},
      );

      readinessRows.push({
        calculated_at: new Date().toISOString(),
        composite_score: readiness.score,
        confidence_modifier: readiness.confidenceModifier,
        crew_member_id: crewMemberId,
        score_components: readiness.scoreComponents as Json,
        score_explanation: readiness.scoreExplanation as Json,
        score_version: request.scoreVersion,
        window_ended_at: readiness.windowEndedAt,
        window_started_at: readiness.windowStartedAt,
      });
    }

    const upsertResult = await client
      .from("readiness_scores")
      .upsert(readinessRows as never, {
        onConflict: "crew_member_id,window_started_at,window_ended_at,score_version",
      })
      .select("id");

    if (upsertResult.error) {
      throw new Error(`[readiness_scores] upsert failed: ${upsertResult.error.message}`);
    }

    await logReadinessScoring(
      client,
      "readiness-scoring-completed",
      "info",
      `Completed readiness scoring for ingestion run ${request.ingestionRunId}.`,
      request.ingestionRunId,
      {
        crew_member_count: crewMemberIds.length,
        normalization_version: request.normalizationVersion,
        rule_version: request.ruleVersion,
        score_count: readinessRows.length,
        score_version: request.scoreVersion,
      },
    );

    return {
      crewMemberCount: crewMemberIds.length,
      ingestionRunId: request.ingestionRunId,
      normalizationVersion: request.normalizationVersion,
      ruleVersion: request.ruleVersion,
      scoreCount: readinessRows.length,
      scoreVersion: request.scoreVersion,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Readiness scoring failed.";

    await logReadinessScoring(
      client,
      "readiness-scoring-failed",
      "error",
      message,
      request.ingestionRunId,
      {
        normalization_version: request.normalizationVersion,
        rule_version: request.ruleVersion,
        score_version: request.scoreVersion,
      },
    );

    throw error;
  }
}

export async function calculateReadinessScoresForIngestionRunWithServiceRole(
  request: ReadinessScoringRequest,
) {
  const client = createSupabaseServiceRoleClient();
  return calculateReadinessScoresForIngestionRun(client, request);
}

export function parseReadinessScoringRequest(input: unknown) {
  return readinessScoringRequestSchema.safeParse(input);
}
