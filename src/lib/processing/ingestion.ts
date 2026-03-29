import { z } from "zod";
import { createSupabaseServiceRoleClient, ingestionRunsRepository, systemLogsRepository, type DatabaseClient, type Json, type TableEnum, type TableInsert } from "@/lib/db";
import { defaultSimulationCrewProfiles, generateSimulationRun } from "@/lib/simulation";
import type { SimulationSignalType } from "@/lib/simulation";

const rawSignalTypeValues = [
  "heart_rate",
  "heart_rate_variability",
  "activity_level",
  "temperature",
  "sleep_duration",
  "sleep_quality",
  "custom",
] as const;

const simulationSignalTypeValues = [
  "heart_rate",
  "heart_rate_variability",
  "activity_level",
  "temperature",
  "sleep_duration",
  "sleep_quality",
] as const;

const rawReadingStatusValues = ["ok", "missing", "dropout"] as const;
const simulationScenarioKindValues = [
  "fatigue_trend",
  "acute_stress",
  "sensor_dropout",
  "recovery_pattern",
] as const;

type SignalTypeValue = (typeof rawSignalTypeValues)[number];
type RawReadingStatusValue = (typeof rawReadingStatusValues)[number];

export type IngestionRejection = {
  capturedAt: string | null;
  crewCode: string | null;
  index: number;
  reason: string;
  signalType: string | null;
  sourceKey: string | null;
};

export type IngestionResult = {
  acceptedRecordCount: number;
  ingestionRunId: number;
  inputRecordCount: number;
  rejectedRecordCount: number;
  rejectionSamples: IngestionRejection[];
  status: TableEnum<"ingestion_run_status">;
};

type IngestionReading = {
  annotations: string[];
  capturedAt: string;
  confidence: number;
  crewCode: string;
  signalType: SignalTypeValue;
  sourceKey: string;
  status: RawReadingStatusValue;
  unit: string;
  value: number | null;
};

type IngestionRequest = {
  readings: unknown[];
  runKind: TableEnum<"ingestion_run_kind">;
  runMetadata?: Json;
  sourceLabel: string;
};

type SimulationIngestionRequest = {
  cadenceSeconds?: number;
  crewCodes?: string[];
  crewCount?: number;
  durationMinutes?: number;
  missingRate?: number;
  noiseScale?: number;
  scenarios?: Array<{
    crewCodes?: string[];
    durationMinutes?: number;
    intensity?: number;
    kind: (typeof simulationScenarioKindValues)[number];
    signalTypes?: SimulationSignalType[];
    startOffsetMinutes?: number;
  }>;
  seed?: number;
  sourceLabel: string;
  startAt?: string;
  timestampJitterSeconds?: number;
};

const ingestionReadingSchema = z
  .object({
    annotations: z.array(z.string()).default([]),
    capturedAt: z.string().datetime({ offset: true }),
    confidence: z.number().min(0).max(1).default(1),
    crewCode: z.string().min(1),
    signalType: z.enum(rawSignalTypeValues),
    sourceKey: z.string().min(1),
    status: z.enum(rawReadingStatusValues).default("ok"),
    unit: z.string().min(1),
    value: z.number().nullable(),
  })
  .superRefine((value, context) => {
    if (value.status === "ok" && value.value === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ok readings require a numeric value.",
        path: ["value"],
      });
    }

    if (value.status === "missing" && value.value !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "missing readings must not include a raw value.",
        path: ["value"],
      });
    }
  });

const simulationScenarioSchema = z.object({
  crewCodes: z.array(z.string().min(1)).min(1).optional(),
  durationMinutes: z.number().int().positive().optional(),
  intensity: z.number().positive().optional(),
  kind: z.enum(simulationScenarioKindValues),
  signalTypes: z.array(z.enum(simulationSignalTypeValues)).min(1).optional(),
  startOffsetMinutes: z.number().int().nonnegative().optional(),
});

export const simulationIngestionRequestSchema = z.object({
  cadenceSeconds: z.number().int().positive().optional(),
  crewCodes: z.array(z.string().min(1)).min(1).optional(),
  crewCount: z
    .number()
    .int()
    .positive()
    .max(defaultSimulationCrewProfiles.length)
    .optional(),
  durationMinutes: z.number().int().positive().optional(),
  missingRate: z.number().min(0).max(1).optional(),
  noiseScale: z.number().nonnegative().optional(),
  scenarios: z.array(simulationScenarioSchema).optional(),
  seed: z.number().int().optional(),
  sourceLabel: z.string().min(1).default("simulation-api"),
  startAt: z.string().datetime({ offset: true }).optional(),
  timestampJitterSeconds: z.number().nonnegative().optional(),
});

function buildRejection(
  index: number,
  reason: string,
  reading?: Partial<Pick<IngestionReading, "capturedAt" | "crewCode" | "signalType" | "sourceKey">>,
): IngestionRejection {
  return {
    capturedAt: reading?.capturedAt ?? null,
    crewCode: reading?.crewCode ?? null,
    index,
    reason,
    signalType: reading?.signalType ?? null,
    sourceKey: reading?.sourceKey ?? null,
  };
}

function summarizeRejections(rejections: IngestionRejection[]) {
  if (rejections.length === 0) {
    return null;
  }

  return rejections
    .slice(0, 5)
    .map((rejection) => `#${rejection.index}: ${rejection.reason}`)
    .join(" | ");
}

export function determineIngestionRunStatus(
  inputRecordCount: number,
  acceptedRecordCount: number,
  rejectedRecordCount: number,
): TableEnum<"ingestion_run_status"> {
  if (inputRecordCount === 0 || acceptedRecordCount === 0) {
    return "failed";
  }

  if (rejectedRecordCount > 0) {
    return "partially_completed";
  }

  return "completed";
}

function toJsonObject(value: Record<string, unknown>): Json {
  return value as Json;
}

function humanizeSignalType(signalType: SignalTypeValue) {
  return signalType
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildSourceIdentifier(
  ingestionRunId: number,
  reading: IngestionReading,
  index: number,
) {
  return `${reading.sourceKey}:${ingestionRunId}:${index}:${reading.capturedAt}`;
}

export function resolveSimulationCrewProfiles(
  crewCodes?: string[],
  crewCount?: number,
) {
  if (crewCodes && crewCodes.length > 0) {
    const requestedCodes = new Set(crewCodes);
    const profiles = defaultSimulationCrewProfiles.filter((profile) =>
      requestedCodes.has(profile.crewCode),
    );

    if (profiles.length !== requestedCodes.size) {
      const foundCodes = new Set(profiles.map((profile) => profile.crewCode));
      const missingCodes = crewCodes.filter((crewCode) => !foundCodes.has(crewCode));

      throw new Error(
        `Unknown simulation crew codes: ${missingCodes.join(", ")}.`,
      );
    }

    return profiles;
  }

  if (crewCount) {
    return defaultSimulationCrewProfiles.slice(0, crewCount);
  }

  return undefined;
}

async function createOrUpdateLog(
  client: DatabaseClient,
  level: TableEnum<"system_log_level">,
  eventType: string,
  message: string,
  details: Record<string, unknown>,
  relatedRecordId: number,
) {
  await systemLogsRepository.create(client, {
    component: "ingestion",
    details: toJsonObject(details),
    event_type: eventType,
    level,
    message,
    related_record_id: relatedRecordId,
    related_table_name: "ingestion_runs",
  });
}

async function resolveCrewMembers(
  client: DatabaseClient,
  readings: Array<{ index: number; reading: IngestionReading }>,
  rejections: IngestionRejection[],
) {
  const crewCodes = [...new Set(readings.map(({ reading }) => reading.crewCode))];

  if (crewCodes.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("crew_members")
    .select("id, crew_code, is_active")
    .in("crew_code", crewCodes);

  if (error) {
    throw new Error(`[crew_members] resolve failed: ${error.message}`);
  }

  const crewByCode = new Map(
    (data ?? []).map((crewMember) => [crewMember.crew_code, crewMember]),
  );

  const accepted = [];

  for (const candidate of readings) {
    const crewMember = crewByCode.get(candidate.reading.crewCode);

    if (!crewMember) {
      rejections.push(
        buildRejection(
          candidate.index,
          `Unknown crew code ${candidate.reading.crewCode}.`,
          candidate.reading,
        ),
      );
      continue;
    }

    if (!crewMember.is_active) {
      rejections.push(
        buildRejection(
          candidate.index,
          `Inactive crew code ${candidate.reading.crewCode}.`,
          candidate.reading,
        ),
      );
      continue;
    }

    accepted.push({
      crewMemberId: crewMember.id,
      index: candidate.index,
      reading: candidate.reading,
    });
  }

  return accepted;
}

async function ensureSensorStreams(
  client: DatabaseClient,
  candidates: Array<{ crewMemberId: number; index: number; reading: IngestionReading }>,
  runKind: TableEnum<"ingestion_run_kind">,
  sourceLabel: string,
) {
  const streamMap = new Map<string, TableInsert<"sensor_streams">>();

  for (const candidate of candidates) {
    const key = `${candidate.crewMemberId}:${candidate.reading.sourceKey}:${candidate.reading.signalType}`;

    if (streamMap.has(key)) {
      continue;
    }

    streamMap.set(key, {
      crew_member_id: candidate.crewMemberId,
      display_name: `${humanizeSignalType(candidate.reading.signalType)} Stream`,
      sampling_cadence_seconds: null,
      signal_type: candidate.reading.signalType,
      source_key: candidate.reading.sourceKey,
      source_vendor: runKind,
      stream_metadata: toJsonObject({
        source_label: sourceLabel,
      }),
      unit: candidate.reading.unit,
    });
  }

  if (streamMap.size === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await client
    .from("sensor_streams")
    .upsert([...streamMap.values()] as never, {
      onConflict: "crew_member_id,source_key,signal_type",
    })
    .select("id, crew_member_id, source_key, signal_type");

  if (error) {
    throw new Error(`[sensor_streams] upsert failed: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((stream) => [
      `${stream.crew_member_id}:${stream.source_key}:${stream.signal_type}`,
      stream.id,
    ]),
  );
}

export async function ingestReadings(
  client: DatabaseClient,
  request: IngestionRequest,
): Promise<IngestionResult> {
  const baseRunMetadata =
    request.runMetadata && typeof request.runMetadata === "object" && !Array.isArray(request.runMetadata)
      ? { ...request.runMetadata }
      : {};
  const inputRecordCount = request.readings.length;
  const initialRun = await ingestionRunsRepository.create(client, {
    input_record_count: inputRecordCount,
    run_kind: request.runKind,
    run_metadata: toJsonObject(baseRunMetadata),
    source_label: request.sourceLabel,
    status: "running",
  });

  await createOrUpdateLog(
    client,
    "info",
    "ingestion-started",
    `Started ${request.runKind} ingestion run.`,
    {
      input_record_count: inputRecordCount,
      source_label: request.sourceLabel,
    },
    initialRun.id,
  );

  try {
    const rejections: IngestionRejection[] = [];
    const validReadings: Array<{ index: number; reading: IngestionReading }> = [];

    request.readings.forEach((input, index) => {
      const parsed = ingestionReadingSchema.safeParse(input);

      if (!parsed.success) {
        rejections.push(
          buildRejection(index, parsed.error.issues.map((issue) => issue.message).join("; ")),
        );
        return;
      }

      validReadings.push({ index, reading: parsed.data });
    });

    const crewResolved = await resolveCrewMembers(client, validReadings, rejections);
    const sensorStreamIds = await ensureSensorStreams(
      client,
      crewResolved,
      request.runKind,
      request.sourceLabel,
    );

    const rawReadingRows: TableInsert<"raw_readings">[] = crewResolved.map(
      ({ crewMemberId, index, reading }) => {
        const streamKey = `${crewMemberId}:${reading.sourceKey}:${reading.signalType}`;
        const sensorStreamId = sensorStreamIds.get(streamKey);

        if (!sensorStreamId) {
          throw new Error(`Missing sensor stream for ${streamKey}.`);
        }

        return {
          captured_at: reading.capturedAt,
          crew_member_id: crewMemberId,
          ingestion_run_id: initialRun.id,
          raw_unit: reading.unit,
          raw_value: reading.value,
          reading_status: reading.status,
          sensor_stream_id: sensorStreamId,
          signal_type: reading.signalType,
          source_identifier: buildSourceIdentifier(initialRun.id, reading, index),
          source_metadata: toJsonObject({
            source_label: request.sourceLabel,
            status: reading.status,
          }),
          source_payload: toJsonObject({
            annotations: reading.annotations,
            confidence: reading.confidence,
            source_key: reading.sourceKey,
            value: reading.value,
          }),
          source_signal_type: reading.signalType,
        };
      },
    );

    if (rawReadingRows.length > 0) {
      const { error } = await client.from("raw_readings").insert(rawReadingRows as never);

      if (error) {
        throw new Error(`[raw_readings] insert failed: ${error.message}`);
      }
    }

    const acceptedRecordCount = rawReadingRows.length;
    const rejectedRecordCount = rejections.length;
    const status = determineIngestionRunStatus(
      inputRecordCount,
      acceptedRecordCount,
      rejectedRecordCount,
    );
    const rejectionSamples = rejections.slice(0, 10);

    await ingestionRunsRepository.update(client, initialRun.id, {
      accepted_record_count: acceptedRecordCount,
      completed_at: new Date().toISOString(),
      error_summary: summarizeRejections(rejections),
      rejected_record_count: rejectedRecordCount,
      run_metadata: toJsonObject({
        ...baseRunMetadata,
        rejection_samples: rejectionSamples,
      }),
      status,
    });

    await createOrUpdateLog(
      client,
      status === "failed" ? "error" : status === "partially_completed" ? "warn" : "info",
      status === "failed" ? "ingestion-failed" : "ingestion-completed",
      `Finished ${request.runKind} ingestion run with status ${status}.`,
      {
        accepted_record_count: acceptedRecordCount,
        rejected_record_count: rejectedRecordCount,
        rejection_samples: rejectionSamples,
        source_label: request.sourceLabel,
      },
      initialRun.id,
    );

    return {
      acceptedRecordCount,
      ingestionRunId: initialRun.id,
      inputRecordCount,
      rejectedRecordCount,
      rejectionSamples,
      status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure.";

    await ingestionRunsRepository.update(client, initialRun.id, {
      completed_at: new Date().toISOString(),
      error_summary: message,
      rejected_record_count: inputRecordCount,
      run_metadata: toJsonObject(baseRunMetadata),
      status: "failed",
    });

    await createOrUpdateLog(
      client,
      "error",
      "ingestion-failed",
      message,
      {
        input_record_count: inputRecordCount,
        source_label: request.sourceLabel,
      },
      initialRun.id,
    );

    throw error;
  }
}

export async function ingestSimulationRequest(request: SimulationIngestionRequest) {
  const client = createSupabaseServiceRoleClient();
  const crewProfiles = resolveSimulationCrewProfiles(
    request.crewCodes,
    request.crewCount,
  );
  const simulationRun = generateSimulationRun({
    cadenceSeconds: request.cadenceSeconds,
    crewProfiles,
    durationMinutes: request.durationMinutes,
    missingRate: request.missingRate,
    noiseScale: request.noiseScale,
    scenarios: request.scenarios,
    seed: request.seed,
    startAt: request.startAt,
    timestampJitterSeconds: request.timestampJitterSeconds,
  });
  const ingestion = await ingestReadings(client, {
    readings: simulationRun.readings,
    runKind: "simulation",
    runMetadata: toJsonObject({
      config: simulationRun.config,
      scenario_windows: simulationRun.scenarioWindows,
    }),
    sourceLabel: request.sourceLabel,
  });

  return {
    ...ingestion,
    generated: {
      cadenceSeconds: simulationRun.config.cadenceSeconds,
      crewCount: simulationRun.crewProfiles.length,
      durationMinutes: simulationRun.config.durationMinutes,
      scenarioKinds: [...new Set(simulationRun.scenarioWindows.map((window) => window.kind))],
      seed: simulationRun.config.seed,
    },
  };
}

export function parseSimulationIngestionRequest(input: unknown) {
  return simulationIngestionRequestSchema.safeParse(input);
}
