import { z } from "zod";
import {
  createSupabaseServiceRoleClient,
  systemLogsRepository,
  type DatabaseClient,
  type Json,
  type TableEnum,
  type TableInsert,
  type TableRow,
} from "@/lib/db";

export const DEFAULT_NORMALIZATION_VERSION = "v1";

export type NormalizationResult = {
  ingestionRunId: number;
  inputRecordCount: number;
  normalizationVersion: string;
  normalizedRecordCount: number;
  signalTypes: TableEnum<"signal_type">[];
  streamCount: number;
};

type NormalizationRequest = {
  ingestionRunId: number;
  normalizationVersion: string;
};

type NormalizationRawReading = Pick<
  TableRow<"raw_readings">,
  | "captured_at"
  | "crew_member_id"
  | "id"
  | "ingestion_run_id"
  | "raw_unit"
  | "raw_value"
  | "reading_status"
  | "sensor_stream_id"
  | "signal_type"
  | "source_identifier"
  | "source_payload"
>;

type BaselineProfile = Record<string, Json | undefined>;

export class NormalizationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "NormalizationError";
  }
}

const normalizationRequestSchema = z.object({
  ingestionRunId: z.number().int().positive(),
  normalizationVersion: z
    .string()
    .trim()
    .min(1)
    .default(DEFAULT_NORMALIZATION_VERSION),
});

const canonicalUnitsBySignal: Record<TableEnum<"signal_type">, string> = {
  activity_level: "normalized",
  custom: "custom",
  heart_rate: "bpm",
  heart_rate_variability: "ms",
  sleep_duration: "hours",
  sleep_quality: "score",
  temperature: "celsius",
};

const rollingWindowSizeBySignal: Record<TableEnum<"signal_type">, number> = {
  activity_level: 3,
  custom: 1,
  heart_rate: 5,
  heart_rate_variability: 5,
  sleep_duration: 3,
  sleep_quality: 3,
  temperature: 4,
};

function asObject(value: Json): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function roundNormalizedValue(signalType: TableEnum<"signal_type">, value: number) {
  if (signalType === "temperature") {
    return Math.round(value * 100) / 100;
  }

  if (signalType === "heart_rate" || signalType === "heart_rate_variability") {
    return Math.round(value * 10) / 10;
  }

  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeUnitLabel(unit: string) {
  return unit.trim().toLowerCase().replace(/\s+/g, "_");
}

export function getCanonicalUnit(signalType: TableEnum<"signal_type">) {
  return canonicalUnitsBySignal[signalType];
}

export function convertToCanonicalValue(
  signalType: TableEnum<"signal_type">,
  rawUnit: string,
  rawValue: number,
) {
  const normalizedUnit = normalizeUnitLabel(rawUnit);

  switch (signalType) {
    case "heart_rate":
      if (["bpm", "beats_per_minute"].includes(normalizedUnit)) {
        return rawValue;
      }
      break;

    case "heart_rate_variability":
      if (["ms", "millisecond", "milliseconds"].includes(normalizedUnit)) {
        return rawValue;
      }
      break;

    case "activity_level":
      if (["normalized", "ratio", "proportion", "unitless"].includes(normalizedUnit)) {
        return rawValue;
      }

      if (["percent", "percentage", "%"].includes(normalizedUnit)) {
        return rawValue / 100;
      }
      break;

    case "temperature":
      if (["c", "celsius", "deg_c", "degree_celsius"].includes(normalizedUnit)) {
        return rawValue;
      }

      if (["f", "fahrenheit", "deg_f", "degree_fahrenheit"].includes(normalizedUnit)) {
        return ((rawValue - 32) * 5) / 9;
      }

      if (["k", "kelvin"].includes(normalizedUnit)) {
        return rawValue - 273.15;
      }
      break;

    case "sleep_duration":
      if (["hour", "hours", "hr", "hrs", "h"].includes(normalizedUnit)) {
        return rawValue;
      }

      if (["minute", "minutes", "min", "mins", "m"].includes(normalizedUnit)) {
        return rawValue / 60;
      }
      break;

    case "sleep_quality":
      if (["score", "points"].includes(normalizedUnit)) {
        return rawValue;
      }

      if (["percent", "percentage", "%"].includes(normalizedUnit)) {
        return rawValue;
      }

      if (["normalized", "ratio", "proportion", "unitless"].includes(normalizedUnit)) {
        return rawValue * 100;
      }
      break;

    case "custom":
      return rawValue;
  }

  throw new NormalizationError(
    `Unsupported unit '${rawUnit}' for signal '${signalType}'.`,
    422,
  );
}

function getNumber(value: Json | undefined) {
  return typeof value === "number" ? value : null;
}

export function getBaselineFallbackValue(
  signalType: TableEnum<"signal_type">,
  baselineProfile: BaselineProfile,
) {
  switch (signalType) {
    case "heart_rate":
      return getNumber(baselineProfile.resting_heart_rate_bpm) ?? 60;
    case "heart_rate_variability":
      return getNumber(baselineProfile.heart_rate_variability_ms) ?? 65;
    case "activity_level":
      return getNumber(baselineProfile.daily_activity_target) ?? 0.5;
    case "temperature":
      return getNumber(baselineProfile.baseline_body_temperature_c) ?? 36.7;
    case "sleep_duration":
      return getNumber(baselineProfile.sleep_target_hours) ?? 7.5;
    case "sleep_quality":
      return getNumber(baselineProfile.sleep_quality_target) ?? 82;
    case "custom":
      return 0;
  }
}

function getRawConfidence(sourcePayload: Json) {
  const payload = asObject(sourcePayload);
  const confidence = payload.confidence;
  return typeof confidence === "number" ? clamp(confidence, 0, 1) : 1;
}

function buildQualityFlags(
  status: TableRow<"raw_readings">["reading_status"],
  options: {
    usedBaselineFallback: boolean;
    usedCarryForward: boolean;
    unitConverted: boolean;
  },
) {
  const flags: string[] = [];

  if (status !== "ok") {
    flags.push(status);
    flags.push("imputed");
  }

  if (options.usedCarryForward) {
    flags.push("carry-forward");
  }

  if (options.usedBaselineFallback) {
    flags.push("baseline-fallback");
  }

  if (options.unitConverted) {
    flags.push("unit-converted");
  }

  return flags;
}

function getWindowTimestamps(window: Array<{ capturedAt: string; value: number }>) {
  return {
    endedAt: window[window.length - 1]?.capturedAt,
    startedAt: window[0]?.capturedAt,
  };
}

function calculateConfidenceScore(options: {
  rawConfidence: number;
  secondsSincePreviousValid: number | null;
  status: TableRow<"raw_readings">["reading_status"];
  usedBaselineFallback: boolean;
  usedCarryForward: boolean;
  windowSize: number;
  targetWindowSize: number;
}) {
  let confidence = options.rawConfidence;

  if (options.status === "missing") {
    confidence -= 0.45;
  }

  if (options.status === "dropout") {
    confidence -= 0.3;
  }

  if (options.usedCarryForward) {
    confidence -= 0.08;
  }

  if (options.usedBaselineFallback) {
    confidence -= 0.15;
  }

  if (options.secondsSincePreviousValid && options.secondsSincePreviousValid > 0) {
    confidence -= Math.min(0.18, options.secondsSincePreviousValid / 3600 / 10);
  }

  if (options.windowSize < options.targetWindowSize) {
    confidence -= (options.targetWindowSize - options.windowSize) * 0.03;
  }

  return clamp(Math.round(confidence * 10000) / 10000, 0, 1);
}

export function normalizeStreamReadings(
  readings: NormalizationRawReading[],
  baselineProfile: BaselineProfile,
  normalizationVersion: string,
): TableInsert<"normalized_readings">[] {
  if (readings.length === 0) {
    return [];
  }

  const signalType = readings[0].signal_type;
  const rollingWindowSize = rollingWindowSizeBySignal[signalType];
  const recentValues: Array<{ capturedAt: string; value: number }> = [];
  let lastValidValue: number | null = null;
  let lastValidCapturedAt: string | null = null;
  let consecutiveMissingCount = 0;
  let consecutiveDropoutCount = 0;

  return readings.map((reading) => {
    const canonicalUnit = getCanonicalUnit(reading.signal_type);
    const rawConfidence = getRawConfidence(reading.source_payload);
    const unitConverted =
      reading.signal_type !== "custom" &&
      normalizeUnitLabel(reading.raw_unit) !== normalizeUnitLabel(canonicalUnit);
    let normalizedInput: number;
    let usedCarryForward = false;
    let usedBaselineFallback = false;

    if (reading.reading_status === "ok") {
      if (typeof reading.raw_value !== "number") {
        throw new NormalizationError(
          `Raw reading ${reading.id} is marked ok without a numeric raw_value.`,
          422,
        );
      }

      normalizedInput = convertToCanonicalValue(
        reading.signal_type,
        reading.raw_unit,
        reading.raw_value,
      );
      lastValidValue = normalizedInput;
      lastValidCapturedAt = reading.captured_at;
      consecutiveMissingCount = 0;
      consecutiveDropoutCount = 0;
    } else {
      if (reading.reading_status === "missing") {
        consecutiveMissingCount += 1;
      }

      if (reading.reading_status === "dropout") {
        consecutiveDropoutCount += 1;
      }

      if (lastValidValue !== null) {
        normalizedInput = lastValidValue;
        usedCarryForward = true;
      } else {
        normalizedInput = getBaselineFallbackValue(signalType, baselineProfile);
        usedBaselineFallback = true;
      }
    }

    recentValues.push({
      capturedAt: reading.captured_at,
      value: normalizedInput,
    });

    if (recentValues.length > rollingWindowSize) {
      recentValues.shift();
    }

    const { startedAt, endedAt } = getWindowTimestamps(recentValues);
    const secondsSincePreviousValid =
      reading.reading_status === "ok" || !lastValidCapturedAt
        ? null
        : Math.max(
            0,
            (Date.parse(reading.captured_at) - Date.parse(lastValidCapturedAt)) / 1000,
          );
    const qualityFlags = buildQualityFlags(reading.reading_status, {
      unitConverted,
      usedBaselineFallback,
      usedCarryForward,
    });
    const normalizedValue = roundNormalizedValue(
      signalType,
      average(recentValues.map((entry) => entry.value)),
    );
    const processingMetadata = {
      consecutive_dropout_count: consecutiveDropoutCount,
      consecutive_missing_count: consecutiveMissingCount,
      imputation_strategy:
        reading.reading_status === "ok"
          ? "none"
          : usedCarryForward
            ? "carry-forward"
            : "baseline-fallback",
      previous_valid_captured_at: lastValidCapturedAt,
      quality_flags: qualityFlags,
      raw_confidence: rawConfidence,
      raw_status: reading.reading_status,
      seconds_since_previous_valid: secondsSincePreviousValid,
      source_identifier: reading.source_identifier,
      unit_converted: unitConverted,
    };

    return {
      captured_at: reading.captured_at,
      confidence_score: calculateConfidenceScore({
        rawConfidence,
        secondsSincePreviousValid,
        status: reading.reading_status,
        targetWindowSize: rollingWindowSize,
        usedBaselineFallback,
        usedCarryForward,
        windowSize: recentValues.length,
      }),
      crew_member_id: reading.crew_member_id,
      normalization_version: normalizationVersion,
      normalized_unit: canonicalUnit,
      normalized_value: normalizedValue,
      processing_metadata: processingMetadata as Json,
      raw_reading_id: reading.id,
      sensor_stream_id: reading.sensor_stream_id,
      signal_type: reading.signal_type,
      source_reading_count: recentValues.length,
      source_window_ended_at: endedAt ?? reading.captured_at,
      source_window_started_at: startedAt ?? reading.captured_at,
    };
  });
}

async function logNormalizationEvent(
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

export async function normalizeIngestionRun(
  client: DatabaseClient,
  request: NormalizationRequest,
): Promise<NormalizationResult> {
  const ingestionRun = await client
    .from("ingestion_runs")
    .select("id, source_label")
    .eq("id", request.ingestionRunId)
    .maybeSingle();

  if (ingestionRun.error) {
    throw new Error(`[ingestion_runs] lookup failed: ${ingestionRun.error.message}`);
  }

  if (!ingestionRun.data) {
    throw new NormalizationError(
      `Ingestion run ${request.ingestionRunId} was not found.`,
      404,
    );
  }

  await logNormalizationEvent(
    client,
    "normalization-started",
    "info",
    `Started normalization for ingestion run ${request.ingestionRunId}.`,
    request.ingestionRunId,
    {
      normalization_version: request.normalizationVersion,
      source_label: ingestionRun.data.source_label,
    },
  );

  try {
    const rawReadingsResult = await client
      .from("raw_readings")
      .select(
        "id, ingestion_run_id, crew_member_id, sensor_stream_id, captured_at, signal_type, raw_unit, raw_value, reading_status, source_identifier, source_payload",
      )
      .eq("ingestion_run_id", request.ingestionRunId)
      .order("sensor_stream_id", { ascending: true })
      .order("captured_at", { ascending: true })
      .order("id", { ascending: true });

    if (rawReadingsResult.error) {
      throw new Error(
        `[raw_readings] select failed: ${rawReadingsResult.error.message}`,
      );
    }

    const rawReadings = (rawReadingsResult.data ?? []) as NormalizationRawReading[];

    if (rawReadings.length === 0) {
      throw new NormalizationError(
        `Ingestion run ${request.ingestionRunId} has no raw readings to normalize.`,
        422,
      );
    }

    const crewMemberIds = [...new Set(rawReadings.map((reading) => reading.crew_member_id))];
    const crewMembersResult = await client
      .from("crew_members")
      .select("id, baseline_profile")
      .in("id", crewMemberIds);

    if (crewMembersResult.error) {
      throw new Error(
        `[crew_members] select failed: ${crewMembersResult.error.message}`,
      );
    }

    const baselineByCrewMember = new Map(
      (crewMembersResult.data ?? []).map((crewMember) => [
        crewMember.id,
        asObject(crewMember.baseline_profile),
      ]),
    );

    const groupedReadings = new Map<number, NormalizationRawReading[]>();

    for (const reading of rawReadings) {
      const current = groupedReadings.get(reading.sensor_stream_id) ?? [];
      current.push(reading);
      groupedReadings.set(reading.sensor_stream_id, current);
    }

    const normalizedRows = [...groupedReadings.values()].flatMap((streamReadings) => {
      const crewMemberId = streamReadings[0]?.crew_member_id;
      const baselineProfile =
        baselineByCrewMember.get(crewMemberId) ?? {};

      return normalizeStreamReadings(
        streamReadings,
        baselineProfile,
        request.normalizationVersion,
      );
    });

    const upsertResult = await client
      .from("normalized_readings")
      .upsert(normalizedRows as never, {
        onConflict: "raw_reading_id,normalization_version",
      })
      .select("id, signal_type");

    if (upsertResult.error) {
      throw new Error(
        `[normalized_readings] upsert failed: ${upsertResult.error.message}`,
      );
    }

    const signalTypes = [
      ...new Set((upsertResult.data ?? []).map((row) => row.signal_type)),
    ] as TableEnum<"signal_type">[];

    await logNormalizationEvent(
      client,
      "normalization-completed",
      "info",
      `Completed normalization for ingestion run ${request.ingestionRunId}.`,
      request.ingestionRunId,
      {
        normalization_version: request.normalizationVersion,
        normalized_record_count: normalizedRows.length,
        signal_types: signalTypes,
        stream_count: groupedReadings.size,
      },
    );

    return {
      ingestionRunId: request.ingestionRunId,
      inputRecordCount: rawReadings.length,
      normalizationVersion: request.normalizationVersion,
      normalizedRecordCount: normalizedRows.length,
      signalTypes,
      streamCount: groupedReadings.size,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Normalization failed.";

    await logNormalizationEvent(
      client,
      "normalization-failed",
      "error",
      message,
      request.ingestionRunId,
      {
        normalization_version: request.normalizationVersion,
      },
    );

    throw error;
  }
}

export async function normalizeIngestionRunWithServiceRole(
  request: NormalizationRequest,
) {
  const client = createSupabaseServiceRoleClient();
  return normalizeIngestionRun(client, request);
}

export function parseNormalizationRequest(input: unknown) {
  return normalizationRequestSchema.safeParse(input);
}
