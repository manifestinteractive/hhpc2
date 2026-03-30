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
import { DEFAULT_NORMALIZATION_VERSION } from "@/lib/processing/normalization";

export const DEFAULT_EVENT_RULE_VERSION = "v1";

export type EventDetectionResult = {
  eventCount: number;
  eventTypes: string[];
  ingestionRunId: number;
  normalizationVersion: string;
  ruleVersion: string;
};

type EventDetectionRequest = {
  ingestionRunId: number;
  normalizationVersion: string;
  ruleVersion: string;
};

type BaselineProfile = Record<string, Json | undefined>;

type EventDetectionNormalizedReading = Pick<
  TableRow<"normalized_readings">,
  | "captured_at"
  | "confidence_score"
  | "crew_member_id"
  | "id"
  | "normalized_unit"
  | "normalized_value"
  | "normalization_version"
  | "processing_metadata"
  | "raw_reading_id"
  | "sensor_stream_id"
  | "signal_type"
  | "source_reading_count"
  | "source_window_ended_at"
  | "source_window_started_at"
>;

export class EventDetectionError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "EventDetectionError";
  }
}

const eventDetectionRequestSchema = z.object({
  ingestionRunId: z.number().int().positive(),
  normalizationVersion: z
    .string()
    .trim()
    .min(1)
    .default(DEFAULT_NORMALIZATION_VERSION),
  ruleVersion: z.string().trim().min(1).default(DEFAULT_EVENT_RULE_VERSION),
});

function asObject(value: Json): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function asStringArray(value: Json | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function getBaselineNumber(
  baselineProfile: BaselineProfile,
  key: string,
  fallback: number,
) {
  const value = baselineProfile[key];
  return typeof value === "number" ? value : fallback;
}

function getRawStatus(reading: EventDetectionNormalizedReading) {
  const metadata = asObject(reading.processing_metadata);
  const rawStatus = metadata.raw_status;
  return rawStatus === "missing" || rawStatus === "dropout" || rawStatus === "ok"
    ? rawStatus
    : "ok";
}

function getQualityFlags(reading: EventDetectionNormalizedReading) {
  return asStringArray(asObject(reading.processing_metadata).quality_flags);
}

function getMetadataNumber(
  reading: EventDetectionNormalizedReading,
  key: string,
) {
  const value = asObject(reading.processing_metadata)[key];
  return typeof value === "number" ? value : null;
}

function buildEventConfidence(
  readingConfidence: number,
  magnitudeScore: number,
  reliabilityPenalty = 0,
) {
  return clamp(
    round(readingConfidence * 0.75 + magnitudeScore * 0.25 - reliabilityPenalty),
    0,
    1,
  );
}

function createDetectedEvent(
  reading: EventDetectionNormalizedReading,
  options: {
    confidenceScore: number;
    eventType: string;
    evidence: Record<string, Json | undefined>;
    explanation: string;
    ruleId: string;
    ruleVersion: string;
    severity: TableEnum<"event_severity">;
  },
): TableInsert<"detected_events"> {
  return {
    confidence_score: options.confidenceScore,
    crew_member_id: reading.crew_member_id,
    ended_at: reading.source_window_ended_at,
    event_type: options.eventType,
    evidence: options.evidence as Json,
    explanation: options.explanation,
    normalized_reading_id: reading.id,
    primary_signal_type: reading.signal_type,
    rule_id: options.ruleId,
    rule_version: options.ruleVersion,
    sensor_stream_id: reading.sensor_stream_id,
    severity: options.severity,
    started_at: reading.source_window_started_at,
  };
}

function detectHeartRateEvent(
  reading: EventDetectionNormalizedReading,
  baselineProfile: BaselineProfile,
  ruleVersion: string,
) {
  const baseline = getBaselineNumber(baselineProfile, "resting_heart_rate_bpm", 60);
  const observed = Number(reading.normalized_value);
  const delta = observed - baseline;
  const ratio = observed / baseline;

  if (delta < 12 && ratio < 1.18) {
    return null;
  }

  const severity: TableEnum<"event_severity"> =
    delta >= 22 || ratio >= 1.35
      ? "high"
      : delta >= 15 || ratio >= 1.24
        ? "medium"
        : "low";
  const magnitudeScore = clamp((ratio - 1.18) / 0.22 + delta / 40, 0, 1);

  return createDetectedEvent(reading, {
    confidenceScore: buildEventConfidence(reading.confidence_score, magnitudeScore),
    eventType: "elevated_heart_rate",
    evidence: {
      baseline_bpm: baseline,
      delta_bpm: round(delta, 1),
      observed_bpm: observed,
      ratio_to_baseline: round(ratio, 4),
    },
    explanation: `Heart rate is ${round(delta, 1)} bpm above the crew baseline (${baseline} bpm).`,
    ruleId: "heart-rate-elevated",
    ruleVersion,
    severity,
  });
}

function detectHrvEvent(
  reading: EventDetectionNormalizedReading,
  baselineProfile: BaselineProfile,
  ruleVersion: string,
) {
  const baseline = getBaselineNumber(
    baselineProfile,
    "heart_rate_variability_ms",
    65,
  );
  const observed = Number(reading.normalized_value);
  const deficit = baseline - observed;
  const ratio = observed / baseline;

  if (deficit < 10 && ratio > 0.82) {
    return null;
  }

  const severity: TableEnum<"event_severity"> =
    deficit >= 25 || ratio <= 0.62
      ? "high"
      : deficit >= 16 || ratio <= 0.74
        ? "medium"
        : "low";
  const magnitudeScore = clamp((0.82 - ratio) / 0.22 + deficit / 45, 0, 1);

  return createDetectedEvent(reading, {
    confidenceScore: buildEventConfidence(reading.confidence_score, magnitudeScore),
    eventType: "suppressed_heart_rate_variability",
    evidence: {
      baseline_ms: baseline,
      deficit_ms: round(deficit, 1),
      observed_ms: observed,
      ratio_to_baseline: round(ratio, 4),
    },
    explanation: `Heart rate variability is ${round(deficit, 1)} ms below the crew baseline (${baseline} ms).`,
    ruleId: "hrv-suppressed",
    ruleVersion,
    severity,
  });
}

function detectActivityEvent(
  reading: EventDetectionNormalizedReading,
  baselineProfile: BaselineProfile,
  ruleVersion: string,
) {
  const baseline = getBaselineNumber(baselineProfile, "daily_activity_target", 0.5);
  const observed = Number(reading.normalized_value);
  const ratio = baseline === 0 ? 1 : observed / baseline;

  if (ratio >= 0.6) {
    return null;
  }

  const severity: TableEnum<"event_severity"> =
    ratio <= 0.3 ? "high" : ratio <= 0.45 ? "medium" : "low";
  const magnitudeScore = clamp((0.6 - ratio) / 0.35, 0, 1);

  return createDetectedEvent(reading, {
    confidenceScore: buildEventConfidence(reading.confidence_score, magnitudeScore),
    eventType: "low_activity_trend",
    evidence: {
      baseline_target: baseline,
      observed_value: observed,
      ratio_to_target: round(ratio, 4),
      source_reading_count: reading.source_reading_count,
    },
    explanation: `Activity is trending below the crew target (${round(ratio * 100, 1)}% of baseline).`,
    ruleId: "activity-low",
    ruleVersion,
    severity,
  });
}

function detectSleepDurationEvent(
  reading: EventDetectionNormalizedReading,
  baselineProfile: BaselineProfile,
  ruleVersion: string,
) {
  const baseline = getBaselineNumber(baselineProfile, "sleep_target_hours", 7.5);
  const observed = Number(reading.normalized_value);
  const ratio = baseline === 0 ? 1 : observed / baseline;

  if (ratio >= 0.88) {
    return null;
  }

  const severity: TableEnum<"event_severity"> =
    ratio <= 0.65 ? "high" : ratio <= 0.78 ? "medium" : "low";
  const magnitudeScore = clamp((0.88 - ratio) / 0.3, 0, 1);

  return createDetectedEvent(reading, {
    confidenceScore: buildEventConfidence(reading.confidence_score, magnitudeScore),
    eventType: "sleep_deficit",
    evidence: {
      baseline_hours: baseline,
      observed_hours: observed,
      ratio_to_target: round(ratio, 4),
    },
    explanation: `Sleep duration is below the crew target (${round(observed, 2)}h vs ${baseline}h baseline).`,
    ruleId: "sleep-duration-deficit",
    ruleVersion,
    severity,
  });
}

function detectSleepQualityEvent(
  reading: EventDetectionNormalizedReading,
  baselineProfile: BaselineProfile,
  ruleVersion: string,
) {
  const baseline = getBaselineNumber(baselineProfile, "sleep_quality_target", 82);
  const observed = Number(reading.normalized_value);
  const ratio = baseline === 0 ? 1 : observed / baseline;

  if (ratio >= 0.9) {
    return null;
  }

  const severity: TableEnum<"event_severity"> =
    ratio <= 0.72 ? "high" : ratio <= 0.82 ? "medium" : "low";
  const magnitudeScore = clamp((0.9 - ratio) / 0.28, 0, 1);

  return createDetectedEvent(reading, {
    confidenceScore: buildEventConfidence(reading.confidence_score, magnitudeScore),
    eventType: "poor_sleep_quality",
    evidence: {
      baseline_score: baseline,
      observed_score: observed,
      ratio_to_target: round(ratio, 4),
    },
    explanation: `Sleep quality is below the crew target (${round(observed, 1)} vs ${baseline}).`,
    ruleId: "sleep-quality-low",
    ruleVersion,
    severity,
  });
}

function detectSensorReliabilityEvent(
  reading: EventDetectionNormalizedReading,
  ruleVersion: string,
) {
  const rawStatus = getRawStatus(reading);
  const qualityFlags = getQualityFlags(reading);
  const consecutiveMissingCount =
    getMetadataNumber(reading, "consecutive_missing_count") ?? 0;
  const consecutiveDropoutCount =
    getMetadataNumber(reading, "consecutive_dropout_count") ?? 0;
  const lowConfidence = reading.confidence_score < 0.72;
  const hasReliabilityIssue =
    rawStatus !== "ok" ||
    lowConfidence ||
    consecutiveMissingCount > 0 ||
    consecutiveDropoutCount > 0 ||
    qualityFlags.includes("imputed");

  if (!hasReliabilityIssue) {
    return null;
  }

  const severity: TableEnum<"event_severity"> =
    reading.confidence_score < 0.4 ||
    consecutiveMissingCount >= 3 ||
    consecutiveDropoutCount >= 3
      ? "high"
      : rawStatus === "dropout" ||
          reading.confidence_score < 0.56 ||
          consecutiveMissingCount >= 2 ||
          consecutiveDropoutCount >= 2
        ? "medium"
        : "low";
  const magnitudeScore = clamp(
    1 - reading.confidence_score + consecutiveMissingCount * 0.08 + consecutiveDropoutCount * 0.1,
    0,
    1,
  );

  return createDetectedEvent(reading, {
    confidenceScore: buildEventConfidence(
      reading.confidence_score,
      magnitudeScore,
      0.05,
    ),
    eventType: "sensor_reliability_issue",
    evidence: {
      consecutive_dropout_count: consecutiveDropoutCount,
      consecutive_missing_count: consecutiveMissingCount,
      quality_flags: qualityFlags,
      raw_status: rawStatus,
      reading_confidence: reading.confidence_score,
    },
    explanation: `Sensor reliability degraded due to ${rawStatus !== "ok" ? rawStatus : "low confidence"} input conditions.`,
    ruleId: "sensor-reliability",
    ruleVersion,
    severity,
  });
}

export function detectEventsForReading(
  reading: EventDetectionNormalizedReading,
  baselineProfile: BaselineProfile,
  ruleVersion: string,
): TableInsert<"detected_events">[] {
  const events: Array<TableInsert<"detected_events"> | null> = [
    detectSensorReliabilityEvent(reading, ruleVersion),
  ];

  switch (reading.signal_type) {
    case "heart_rate":
      events.push(detectHeartRateEvent(reading, baselineProfile, ruleVersion));
      break;
    case "heart_rate_variability":
      events.push(detectHrvEvent(reading, baselineProfile, ruleVersion));
      break;
    case "activity_level":
      events.push(detectActivityEvent(reading, baselineProfile, ruleVersion));
      break;
    case "sleep_duration":
      events.push(detectSleepDurationEvent(reading, baselineProfile, ruleVersion));
      break;
    case "sleep_quality":
      events.push(detectSleepQualityEvent(reading, baselineProfile, ruleVersion));
      break;
    case "temperature":
    case "custom":
      break;
  }

  return events.filter((event): event is TableInsert<"detected_events"> => event !== null);
}

async function logEventDetection(
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

export async function detectEventsForIngestionRun(
  client: DatabaseClient,
  request: EventDetectionRequest,
): Promise<EventDetectionResult> {
  await logEventDetection(
    client,
    "event-detection-started",
    "info",
    `Started event detection for ingestion run ${request.ingestionRunId}.`,
    request.ingestionRunId,
    {
      normalization_version: request.normalizationVersion,
      rule_version: request.ruleVersion,
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
      throw new EventDetectionError(
        `Ingestion run ${request.ingestionRunId} has no raw readings to evaluate.`,
        422,
      );
    }

    const normalizedReadings = (
      await Promise.all(
        chunkValues(rawReadingIds).map(async (rawReadingIdChunk) => {
          const result = await client
            .from("normalized_readings")
            .select(
              "id, crew_member_id, sensor_stream_id, raw_reading_id, captured_at, signal_type, normalized_value, normalized_unit, confidence_score, source_window_started_at, source_window_ended_at, source_reading_count, normalization_version, processing_metadata",
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

          return (result.data ?? []) as EventDetectionNormalizedReading[];
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
      throw new EventDetectionError(
        `Ingestion run ${request.ingestionRunId} has no normalized readings for version ${request.normalizationVersion}.`,
        422,
      );
    }

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

    const normalizedIds = normalizedReadings.map((reading) => reading.id);

    await Promise.all(
      chunkValues(normalizedIds).map(async (normalizedIdChunk) => {
        const { error } = await client
          .from("detected_events")
          .delete()
          .eq("rule_version", request.ruleVersion)
          .in("normalized_reading_id", normalizedIdChunk);

        if (error) {
          throw new Error(`[detected_events] delete failed: ${error.message}`);
        }
      }),
    );

    const detectedEvents = normalizedReadings.flatMap((reading) =>
      detectEventsForReading(
        reading,
        baselineByCrewMember.get(reading.crew_member_id) ?? {},
        request.ruleVersion,
      ),
    );

    if (detectedEvents.length > 0) {
      const insertResult = await client
        .from("detected_events")
        .insert(detectedEvents as never)
        .select("event_type");

      if (insertResult.error) {
        throw new Error(`[detected_events] insert failed: ${insertResult.error.message}`);
      }
    }

    const eventTypes = [...new Set(detectedEvents.map((event) => event.event_type))];

    await logEventDetection(
      client,
      "event-detection-completed",
      "info",
      `Completed event detection for ingestion run ${request.ingestionRunId}.`,
      request.ingestionRunId,
      {
        event_count: detectedEvents.length,
        event_types: eventTypes,
        normalization_version: request.normalizationVersion,
        rule_version: request.ruleVersion,
      },
    );

    return {
      eventCount: detectedEvents.length,
      eventTypes,
      ingestionRunId: request.ingestionRunId,
      normalizationVersion: request.normalizationVersion,
      ruleVersion: request.ruleVersion,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Event detection failed.";

    await logEventDetection(
      client,
      "event-detection-failed",
      "error",
      message,
      request.ingestionRunId,
      {
        normalization_version: request.normalizationVersion,
        rule_version: request.ruleVersion,
      },
    );

    throw error;
  }
}

export async function detectEventsForIngestionRunWithServiceRole(
  request: EventDetectionRequest,
) {
  const client = createSupabaseServiceRoleClient();
  return detectEventsForIngestionRun(client, request);
}

export function parseEventDetectionRequest(input: unknown) {
  return eventDetectionRequestSchema.safeParse(input);
}
