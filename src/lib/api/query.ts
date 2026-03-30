import { z } from "zod";
import {
  chunkValues,
  createSupabaseServiceRoleClient,
  fetchAllPages,
  type DatabaseClient,
  type Json,
} from "@/lib/db";
import { getDependencyReports, getEnvironmentSummary } from "@/lib/health";
import type {
  AdminObservabilityResponse,
  AdminSummaryJobItem,
  CrewDetailResponse,
  CrewTelemetryBundle,
  CrewListResponse,
  DashboardLiveResponse,
  EventListResponse,
  ReadinessScoreListResponse,
  SummaryDetail,
  SummaryListResponse,
} from "@/types/api";
import { buildFleetTrend, getSignalLabel, sortCrewByRisk } from "@/lib/dashboard";

const limitSchema = z.coerce.number().int().positive().max(100).default(25);
const TELEMETRY_WINDOW_MS = 60 * 60 * 1000;
const TELEMETRY_POINT_FETCH_LIMIT = 1000;
const AI_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;

type CrewSummaryRow = {
  call_sign: string | null;
  crew_code: string;
  display_name: string;
  role_title: string;
  sort_order: number;
};

type CrewDetailRow = {
  baseline_profile: Json;
  baseline_timezone: string;
  call_sign: string | null;
  crew_code: string;
  display_name: string;
  family_name: string;
  given_name: string;
  profile_metadata: Json;
  role_title: string;
};

type EventQueryFilters = {
  crewCode?: string;
  limit?: number;
  severity?: "high" | "medium" | "low";
};

type ReadinessScoreFilters = {
  crewCode?: string;
  limit?: number;
};

type SummaryFilters = {
  crewCode?: string;
  limit?: number;
  reviewStatus?: "approved" | "dismissed" | "pending";
  scopeKind?: "crew_member" | "fleet";
};

type SignalTypeValue = "heart_rate" | "heart_rate_variability" | "activity_level" | "temperature" | "sleep_duration" | "sleep_quality" | "custom";

type LatestIngestionRunRow = {
  accepted_record_count: number;
  completed_at: string | null;
  id: number;
  rejected_record_count: number;
  run_metadata: Json;
  source_label: string;
  started_at: string;
  status: "pending" | "running" | "completed" | "partially_completed" | "failed";
};

type SummaryJobStatusRow = {
  crew_member_id: number;
  last_error: string | null;
  readiness_score_id: number;
  status: "failed" | "pending" | "running";
};

type AdminSummaryJobRow = {
  attempt_count: number;
  completed_at: string | null;
  crew_member_id: number;
  enqueued_at: string;
  id: number;
  last_error: string | null;
  readiness_score_id: number;
  started_at: string | null;
  status: "completed" | "failed" | "pending" | "running";
};

function getLimit(value: number | undefined) {
  return limitSchema.parse(value ?? 25);
}

function mapSummaryRow(
  row: {
    crew_member_id: number | null;
    generated_at: string;
    id: number;
    model_name: string;
    provider_name: string;
    readiness_score_id: number | null;
    review_status: "approved" | "dismissed" | "pending";
    reviewed_at: string | null;
    scope_kind: "crew_member" | "fleet";
    structured_input_context: Json;
    summary_text: string;
  },
  crewById: Map<number, { crewCode: string; displayName: string }>,
): SummaryDetail {
  const crew = row.crew_member_id ? crewById.get(row.crew_member_id) : null;

  return {
    crewCode: crew?.crewCode ?? null,
    crewDisplayName: crew?.displayName ?? null,
    generatedAt: row.generated_at,
    id: row.id,
    modelName: row.model_name,
    providerName: row.provider_name,
    readinessScoreId: row.readiness_score_id,
    reviewStatus: row.review_status,
    reviewedAt: row.reviewed_at,
    scopeKind: row.scope_kind,
    structuredInputContext: row.structured_input_context,
    summaryText: row.summary_text,
  };
}

function getSummaryPresentationState(input: {
  latestJob?: SummaryJobStatusRow | null;
  latestReadiness:
    | {
        confidenceModifier: number;
        id: number;
      }
    | null
    | undefined;
  latestSummary: SummaryDetail | null;
}) {
  const latestReadiness = input.latestReadiness;
  const latestSummary = input.latestSummary;
  const latestJob = input.latestJob ?? null;

  if (
    latestReadiness &&
    latestSummary &&
    latestSummary.readinessScoreId === latestReadiness.id
  ) {
    return {
      summaryState: "ready" as const,
      summaryStatusText: latestSummary.summaryText,
    };
  }

  if (
    latestJob &&
    latestReadiness &&
    latestJob.readiness_score_id === latestReadiness.id
  ) {
    if (latestJob.status === "failed") {
      return {
        summaryState: "failed" as const,
        summaryStatusText: "Summary generation failed.",
      };
    }

    return {
      summaryState: "pending" as const,
      summaryStatusText:
        latestJob.status === "running" ? "Summarizing now..." : "Summarizing...",
    };
  }

  if (!latestReadiness) {
    return {
      summaryState: "unavailable" as const,
      summaryStatusText: "No scored telemetry yet.",
    };
  }

  if (latestReadiness.confidenceModifier < AI_SUMMARY_CONFIDENCE_THRESHOLD) {
    return {
      summaryState: "unavailable" as const,
      summaryStatusText: "Waiting for confidence above 80%.",
    };
  }

  return {
    summaryState: "unavailable" as const,
    summaryStatusText: "Awaiting summary job.",
  };
}

function buildCrewMap(rows: Array<{ crew_code: string; display_name: string; id: number }>) {
  const crewById = new Map(
    rows.map((row) => [
      row.id,
      {
        crewCode: row.crew_code,
        displayName: row.display_name,
      },
    ]),
  );

  return crewById;
}

function getScenarioKindsFromRunMetadata(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const scenarioWindows = (value as Record<string, unknown>).scenario_windows;

  if (!Array.isArray(scenarioWindows)) {
    return [];
  }

  return [
    ...new Set(
      scenarioWindows
        .map((window) => {
          if (!window || typeof window !== "object" || Array.isArray(window)) {
            return null;
          }

          const kind = (window as Record<string, unknown>).kind;
          return typeof kind === "string" ? kind : null;
        })
        .filter((kind): kind is string => kind !== null),
    ),
  ];
}

function getSeedFromRunMetadata(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const config = (value as Record<string, unknown>).config;

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const seed = (config as Record<string, unknown>).seed;
  return typeof seed === "number" ? seed : null;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isWithinLast24Hours(isoTimestamp: string, cutoffTimeMs: number) {
  return Date.parse(isoTimestamp) >= cutoffTimeMs;
}

function buildTelemetryBundle(
  crewCode: string,
  crewDisplayName: string,
  rows: Array<{
    captured_at: string;
    confidence_score: number;
    normalized_unit: string;
    normalized_value: number;
    signal_type: SignalTypeValue;
  }>,
): CrewTelemetryBundle | null {
  if (rows.length === 0) {
    return null;
  }

  const latestCapturedAt = rows.reduce((latest, row) => {
    const timestamp = Date.parse(row.captured_at);
    return Number.isNaN(timestamp) ? latest : Math.max(latest, timestamp);
  }, 0);
  const visibleRows =
    latestCapturedAt > 0
      ? rows.filter(
          (row) =>
            Date.parse(row.captured_at) >= latestCapturedAt - TELEMETRY_WINDOW_MS,
        )
      : rows;

  const telemetryBySignal = new Map<
    string,
    {
      normalizedUnit: string;
      points: Array<{
        capturedAt: string;
        confidenceScore: number;
        normalizedValue: number;
      }>;
    }
  >();

  for (const row of visibleRows) {
    const current = telemetryBySignal.get(row.signal_type) ?? {
      normalizedUnit: row.normalized_unit,
      points: [],
    };

    current.points.push({
      capturedAt: row.captured_at,
      confidenceScore: row.confidence_score,
      normalizedValue: row.normalized_value,
    });

    telemetryBySignal.set(row.signal_type, current);
  }

  return {
    crewCode,
    crewDisplayName,
    series: [...telemetryBySignal.entries()]
      .map(([signalType, series]) => ({
        label: getSignalLabel(signalType as SignalTypeValue),
        normalizedUnit: series.normalizedUnit,
        points: series.points
          .sort(
            (left, right) =>
              new Date(left.capturedAt).getTime() -
              new Date(right.capturedAt).getTime(),
          ),
        signalType: signalType as SignalTypeValue,
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

async function getDetectedEventsForIngestionRun(
  client: DatabaseClient,
  ingestionRunId: number,
  crewById: Map<number, { crewCode: string; displayName: string }>,
  limit = 8,
) {
  const rawReadingRows = await fetchAllPages<{ id: number }>(async (from, to) =>
    client
      .from("raw_readings")
      .select("id")
      .eq("ingestion_run_id", ingestionRunId)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const rawReadingIds = rawReadingRows.map((row) => row.id);

  if (rawReadingIds.length === 0) {
    return [];
  }

  const normalizedReadingRows = (
    await Promise.all(
      chunkValues(rawReadingIds).map(async (rawReadingIdChunk) => {
        const result = await client
          .from("normalized_readings")
          .select("id")
          .in("raw_reading_id", rawReadingIdChunk);

        if (result.error) {
          throw new Error(
            `[normalized_readings] run event lookup failed: ${result.error.message}`,
          );
        }

        return result.data ?? [];
      }),
    )
  ).flat();
  const normalizedReadingIds = normalizedReadingRows.map((row) => row.id);

  if (normalizedReadingIds.length === 0) {
    return [];
  }

  const detectedEventRows = (
    await Promise.all(
      chunkValues(normalizedReadingIds).map(async (normalizedIdChunk) => {
        const result = await client
          .from("detected_events")
          .select(
            "id, crew_member_id, event_type, severity, confidence_score, started_at, ended_at, primary_signal_type, rule_id, rule_version, explanation, evidence",
          )
          .in("normalized_reading_id", normalizedIdChunk)
          .order("started_at", { ascending: false });

        if (result.error) {
          throw new Error(
            `[detected_events] run event lookup failed: ${result.error.message}`,
          );
        }

        return result.data ?? [];
      }),
    )
  )
    .flat()
    .sort((left, right) => right.started_at.localeCompare(left.started_at))
    .slice(0, limit);

  return detectedEventRows.map((row) => {
    const crew = crewById.get(row.crew_member_id);

    return {
      confidenceScore: row.confidence_score,
      crewCode: crew?.crewCode ?? null,
      crewDisplayName: crew?.displayName ?? null,
      endedAt: row.ended_at,
      eventType: row.event_type,
      evidence: row.evidence,
      explanation: row.explanation,
      id: row.id,
      primarySignalType: row.primary_signal_type,
      ruleId: row.rule_id,
      ruleVersion: row.rule_version,
      severity: row.severity,
      startedAt: row.started_at,
    };
  });
}

export async function listCrewOverview(
  client: DatabaseClient,
): Promise<CrewListResponse> {
  const crewsResult = await client
    .from("crew_members")
    .select("id, crew_code, display_name, call_sign, role_title, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (crewsResult.error) {
    throw new Error(`[crew_members] overview select failed: ${crewsResult.error.message}`);
  }

  const crews = (crewsResult.data ?? []) as Array<CrewSummaryRow & { id: number }>;
  const crewIds = crews.map((crew) => crew.id);
  const latestScoresResult =
    crewIds.length === 0
      ? { data: [], error: null }
      : await client
          .from("readiness_scores")
          .select(
            "id, crew_member_id, composite_score, confidence_modifier, calculated_at, score_version",
          )
          .in("crew_member_id", crewIds)
          .order("calculated_at", { ascending: false });

  if (latestScoresResult.error) {
    throw new Error(
      `[readiness_scores] overview select failed: ${latestScoresResult.error.message}`,
    );
  }

  const recentEventsResult =
    crewIds.length === 0
      ? { data: [], error: null }
      : await client
          .from("detected_events")
          .select("id, crew_member_id, event_type, severity, started_at")
          .in("crew_member_id", crewIds)
          .order("started_at", { ascending: false })
          .limit(200);

  if (recentEventsResult.error) {
    throw new Error(
      `[detected_events] overview select failed: ${recentEventsResult.error.message}`,
    );
  }

  const latestScoreByCrew = new Map<number, (typeof latestScoresResult.data)[number]>();

  for (const row of latestScoresResult.data ?? []) {
    if (!latestScoreByCrew.has(row.crew_member_id)) {
      latestScoreByCrew.set(row.crew_member_id, row);
    }
  }

  const latestScoreIds = [...latestScoreByCrew.values()].map((row) => row.id);
  const [summaryResult, summaryJobsResult] = await Promise.all([
    latestScoreIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client
          .from("ai_summaries")
          .select(
            "id, crew_member_id, readiness_score_id, summary_text, scope_kind, review_status, generated_at, provider_name, model_name, structured_input_context, reviewed_at",
          )
          .in("readiness_score_id", latestScoreIds)
          .eq("scope_kind", "crew_member")
          .order("generated_at", { ascending: false }),
    crewIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client
          .from("ai_summary_jobs")
          .select("crew_member_id, readiness_score_id, status, last_error")
          .in("crew_member_id", crewIds)
          .in("status", ["pending", "running", "failed"])
          .order("enqueued_at", { ascending: false }),
  ]);

  if (summaryResult.error) {
    throw new Error(
      `[ai_summaries] overview summary select failed: ${summaryResult.error.message}`,
    );
  }

  if (summaryJobsResult.error) {
    throw new Error(
      `[ai_summary_jobs] overview summary job select failed: ${summaryJobsResult.error.message}`,
    );
  }

  const eventsByCrew = new Map<number, (typeof recentEventsResult.data)>();

  for (const event of recentEventsResult.data ?? []) {
    const current = eventsByCrew.get(event.crew_member_id) ?? [];
    current.push(event);
    eventsByCrew.set(event.crew_member_id, current);
  }

  const crewById = buildCrewMap(crews);
  const latestSummaryByScoreId = new Map<number, SummaryDetail>();

  for (const row of summaryResult.data ?? []) {
    if (!latestSummaryByScoreId.has(row.readiness_score_id ?? -1) && row.readiness_score_id != null) {
      latestSummaryByScoreId.set(row.readiness_score_id, mapSummaryRow(row, crewById));
    }
  }

  const latestJobByCrewId = new Map<number, SummaryJobStatusRow>();

  for (const row of (summaryJobsResult.data ?? []) as SummaryJobStatusRow[]) {
    if (!latestJobByCrewId.has(row.crew_member_id)) {
      latestJobByCrewId.set(row.crew_member_id, row);
    }
  }

  return {
    crews: crews.map((crew) => {
      const latestScore = latestScoreByCrew.get(crew.id) ?? null;
      const recentEvents = eventsByCrew.get(crew.id) ?? [];
      const latestSummary =
        latestScore != null
          ? latestSummaryByScoreId.get(latestScore.id) ?? null
          : null;
      const summaryPresentation = getSummaryPresentationState({
        latestJob: latestJobByCrewId.get(crew.id) ?? null,
        latestReadiness: latestScore
          ? {
              confidenceModifier: latestScore.confidence_modifier,
              id: latestScore.id,
            }
          : null,
        latestSummary,
      });

      return {
        callSign: crew.call_sign,
        crewCode: crew.crew_code,
        displayName: crew.display_name,
        latestEvent: recentEvents[0]
          ? {
              eventType: recentEvents[0].event_type,
              severity: recentEvents[0].severity,
              startedAt: recentEvents[0].started_at,
            }
          : null,
        latestReadiness: latestScore
          ? {
            calculatedAt: latestScore.calculated_at,
            compositeScore: latestScore.composite_score,
            confidenceModifier: latestScore.confidence_modifier,
            id: latestScore.id,
            scoreVersion: latestScore.score_version,
          }
          : null,
        latestSummary,
        recentEventCounts: {
          high: recentEvents.filter((event) => event.severity === "high").length,
          low: recentEvents.filter((event) => event.severity === "low").length,
          medium: recentEvents.filter((event) => event.severity === "medium").length,
        },
        roleTitle: crew.role_title,
        summaryState: summaryPresentation.summaryState,
        summaryStatusText: summaryPresentation.summaryStatusText,
      };
    }),
  };
}

export async function getCrewDetail(
  client: DatabaseClient,
  crewCode: string,
): Promise<CrewDetailResponse | null> {
  const crewResult = await client
    .from("crew_members")
    .select(
      "id, crew_code, display_name, given_name, family_name, call_sign, role_title, baseline_timezone, baseline_profile, profile_metadata",
    )
    .eq("crew_code", crewCode)
    .maybeSingle();

  if (crewResult.error) {
    throw new Error(`[crew_members] detail select failed: ${crewResult.error.message}`);
  }

  if (!crewResult.data) {
    return null;
  }

  const crew = crewResult.data as CrewDetailRow & { id: number };
  const [readinessResult, eventsResult, normalizedResult, telemetryResult] = await Promise.all([
    client
      .from("readiness_scores")
      .select(
        "id, calculated_at, window_started_at, window_ended_at, composite_score, confidence_modifier, score_components, score_explanation, score_version",
      )
      .eq("crew_member_id", crew.id)
      .order("calculated_at", { ascending: false })
      .limit(12),
    client
      .from("detected_events")
      .select(
        "id, event_type, severity, confidence_score, started_at, ended_at, primary_signal_type, rule_id, rule_version, explanation, evidence",
      )
      .eq("crew_member_id", crew.id)
      .order("started_at", { ascending: false })
      .limit(20),
    client
      .from("normalized_readings")
      .select(
        "id, signal_type, normalized_value, normalized_unit, confidence_score, captured_at",
      )
      .eq("crew_member_id", crew.id)
      .order("captured_at", { ascending: false })
      .limit(48),
    client
      .from("normalized_readings")
      .select(
        "signal_type, normalized_value, normalized_unit, confidence_score, captured_at",
      )
      .eq("crew_member_id", crew.id)
      .order("captured_at", { ascending: false })
      .limit(TELEMETRY_POINT_FETCH_LIMIT),
  ]);

  if (readinessResult.error) {
    throw new Error(
      `[readiness_scores] detail select failed: ${readinessResult.error.message}`,
    );
  }

  if (eventsResult.error) {
    throw new Error(`[detected_events] detail select failed: ${eventsResult.error.message}`);
  }

  if (normalizedResult.error) {
    throw new Error(
      `[normalized_readings] detail select failed: ${normalizedResult.error.message}`,
    );
  }

  if (telemetryResult.error) {
    throw new Error(
      `[normalized_readings] telemetry select failed: ${telemetryResult.error.message}`,
    );
  }

  const latestReadiness = readinessResult.data?.[0] ?? null;
  const [latestSummaryResult, summaryJobsResult] = await Promise.all([
    latestReadiness
      ? client
          .from("ai_summaries")
          .select(
            "id, crew_member_id, readiness_score_id, summary_text, scope_kind, review_status, generated_at, provider_name, model_name, structured_input_context, reviewed_at",
          )
          .eq("scope_kind", "crew_member")
          .eq("readiness_score_id", latestReadiness.id)
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from("ai_summary_jobs")
      .select("crew_member_id, readiness_score_id, status, last_error")
      .eq("crew_member_id", crew.id)
      .in("status", ["pending", "running", "failed"])
      .order("enqueued_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (latestSummaryResult.error) {
    throw new Error(
      `[ai_summaries] detail summary select failed: ${latestSummaryResult.error.message}`,
    );
  }

  if (summaryJobsResult.error) {
    throw new Error(
      `[ai_summary_jobs] detail summary job select failed: ${summaryJobsResult.error.message}`,
    );
  }

  const latestSignalByType = new Map<
    string,
    (typeof normalizedResult.data)[number]
  >();

  for (const row of normalizedResult.data ?? []) {
    if (!latestSignalByType.has(row.signal_type)) {
      latestSignalByType.set(row.signal_type, row);
    }
  }

  const crewById = buildCrewMap([
    {
      crew_code: crew.crew_code,
      display_name: crew.display_name,
      id: crew.id,
    },
  ]);
  const latestSummary = latestSummaryResult.data
    ? mapSummaryRow(latestSummaryResult.data, crewById)
    : null;
  const summaryPresentation = getSummaryPresentationState({
    latestJob: (summaryJobsResult.data as SummaryJobStatusRow | null) ?? null,
    latestReadiness: latestReadiness
      ? {
          confidenceModifier: latestReadiness.confidence_modifier,
          id: latestReadiness.id,
        }
      : null,
    latestSummary,
  });

  return {
    crew: {
      baselineProfile: crew.baseline_profile,
      baselineTimezone: crew.baseline_timezone,
      callSign: crew.call_sign,
      crewCode: crew.crew_code,
      displayName: crew.display_name,
      familyName: crew.family_name,
      givenName: crew.given_name,
      profileMetadata: crew.profile_metadata,
      roleTitle: crew.role_title,
    },
    latestReadiness: latestReadiness
      ? {
        calculatedAt: latestReadiness.calculated_at,
        compositeScore: latestReadiness.composite_score,
        confidenceModifier: latestReadiness.confidence_modifier,
        id: latestReadiness.id,
        scoreComponents: latestReadiness.score_components,
        scoreExplanation: latestReadiness.score_explanation,
        scoreVersion: latestReadiness.score_version,
      }
      : null,
    readinessHistory: (readinessResult.data ?? []).map((row) => ({
      calculatedAt: row.calculated_at,
      compositeScore: row.composite_score,
      confidenceModifier: row.confidence_modifier,
      crewCode: crew.crew_code,
      crewDisplayName: crew.display_name,
      id: row.id,
      scoreComponents: row.score_components,
      scoreExplanation: row.score_explanation,
      scoreVersion: row.score_version,
      windowEndedAt: row.window_ended_at,
      windowStartedAt: row.window_started_at,
    })),
    recentEvents: (eventsResult.data ?? []).map((row) => ({
      confidenceScore: row.confidence_score,
      crewCode: crew.crew_code,
      crewDisplayName: crew.display_name,
      endedAt: row.ended_at,
      eventType: row.event_type,
      evidence: row.evidence,
      explanation: row.explanation,
      id: row.id,
      primarySignalType: row.primary_signal_type,
      ruleId: row.rule_id,
      ruleVersion: row.rule_version,
      severity: row.severity,
      startedAt: row.started_at,
    })),
    signalSnapshots: [...latestSignalByType.values()]
      .sort((left, right) => left.signal_type.localeCompare(right.signal_type))
      .map((row) => ({
        capturedAt: row.captured_at,
        confidenceScore: row.confidence_score,
        normalizedUnit: row.normalized_unit,
        normalizedValue: row.normalized_value,
        signalType: row.signal_type,
      })),
    telemetryHistory: buildTelemetryBundle(
      crew.crew_code,
      crew.display_name,
      (telemetryResult.data ?? []) as Array<{
        captured_at: string;
        confidence_score: number;
        normalized_unit: string;
        normalized_value: number;
        signal_type: SignalTypeValue;
      }>,
    ),
    latestSummary,
    summaryState: summaryPresentation.summaryState,
    summaryStatusText: summaryPresentation.summaryStatusText,
  };
}

export async function listEvents(
  client: DatabaseClient,
  filters: EventQueryFilters = {},
): Promise<EventListResponse> {
  const limit = getLimit(filters.limit);
  const crewsResult = await client
    .from("crew_members")
    .select("id, crew_code, display_name");

  if (crewsResult.error) {
    throw new Error(`[crew_members] events lookup failed: ${crewsResult.error.message}`);
  }

  const crewById = buildCrewMap(crewsResult.data ?? []);
  let query = client
    .from("detected_events")
    .select(
      "id, crew_member_id, event_type, severity, confidence_score, started_at, ended_at, primary_signal_type, rule_id, rule_version, explanation, evidence",
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (filters.severity) {
    query = query.eq("severity", filters.severity);
  }

  if (filters.crewCode) {
    const targetCrew = (crewsResult.data ?? []).find(
      (crew) => crew.crew_code === filters.crewCode,
    );

    if (!targetCrew) {
      return { events: [] };
    }

    query = query.eq("crew_member_id", targetCrew.id);
  }

  const eventsResult = await query;

  if (eventsResult.error) {
    throw new Error(`[detected_events] list failed: ${eventsResult.error.message}`);
  }

  return {
    events: (eventsResult.data ?? []).map((row) => {
      const crew = crewById.get(row.crew_member_id);

      return {
        confidenceScore: row.confidence_score,
        crewCode: crew?.crewCode ?? null,
        crewDisplayName: crew?.displayName ?? null,
        endedAt: row.ended_at,
        eventType: row.event_type,
        evidence: row.evidence,
        explanation: row.explanation,
        id: row.id,
        primarySignalType: row.primary_signal_type,
        ruleId: row.rule_id,
        ruleVersion: row.rule_version,
        severity: row.severity,
        startedAt: row.started_at,
      };
    }),
  };
}

export async function listReadinessScores(
  client: DatabaseClient,
  filters: ReadinessScoreFilters = {},
): Promise<ReadinessScoreListResponse> {
  const limit = getLimit(filters.limit);
  const crewsResult = await client
    .from("crew_members")
    .select("id, crew_code, display_name");

  if (crewsResult.error) {
    throw new Error(
      `[crew_members] readiness lookup failed: ${crewsResult.error.message}`,
    );
  }

  const crewById = buildCrewMap(crewsResult.data ?? []);
  let query = client
    .from("readiness_scores")
    .select(
      "id, crew_member_id, calculated_at, window_started_at, window_ended_at, composite_score, confidence_modifier, score_components, score_explanation, score_version",
    )
    .order("calculated_at", { ascending: false })
    .limit(limit);

  if (filters.crewCode) {
    const targetCrew = (crewsResult.data ?? []).find(
      (crew) => crew.crew_code === filters.crewCode,
    );

    if (!targetCrew) {
      return { scores: [] };
    }

    query = query.eq("crew_member_id", targetCrew.id);
  }

  const readinessResult = await query;

  if (readinessResult.error) {
    throw new Error(`[readiness_scores] list failed: ${readinessResult.error.message}`);
  }

  return {
    scores: (readinessResult.data ?? []).map((row) => {
      const crew = crewById.get(row.crew_member_id);

      return {
        calculatedAt: row.calculated_at,
        compositeScore: row.composite_score,
        confidenceModifier: row.confidence_modifier,
        crewCode: crew?.crewCode ?? null,
        crewDisplayName: crew?.displayName ?? null,
        id: row.id,
        scoreComponents: row.score_components,
        scoreExplanation: row.score_explanation,
        scoreVersion: row.score_version,
        windowEndedAt: row.window_ended_at,
        windowStartedAt: row.window_started_at,
      };
    }),
  };
}

export async function listSummaries(
  client: DatabaseClient,
  filters: SummaryFilters = {},
): Promise<SummaryListResponse> {
  const limit = getLimit(filters.limit ?? 10);
  const crewsResult = await client
    .from("crew_members")
    .select("id, crew_code, display_name");

  if (crewsResult.error) {
    throw new Error(`[crew_members] summaries lookup failed: ${crewsResult.error.message}`);
  }

  const crewById = buildCrewMap(crewsResult.data ?? []);
  let query = client
    .from("ai_summaries")
    .select(
      "id, crew_member_id, readiness_score_id, summary_text, scope_kind, review_status, generated_at, provider_name, model_name, structured_input_context, reviewed_at",
    )
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (filters.reviewStatus) {
    query = query.eq("review_status", filters.reviewStatus);
  }

  if (filters.scopeKind) {
    query = query.eq("scope_kind", filters.scopeKind);
  }

  if (filters.crewCode) {
    const targetCrew = (crewsResult.data ?? []).find(
      (crew) => crew.crew_code === filters.crewCode,
    );

    if (!targetCrew) {
      return { summaries: [] };
    }

    query = query.eq("crew_member_id", targetCrew.id);
  }

  const summariesResult = await query;

  if (summariesResult.error) {
    throw new Error(`[ai_summaries] list failed: ${summariesResult.error.message}`);
  }

  return {
    summaries: (summariesResult.data ?? []).map((row) => mapSummaryRow(row, crewById)),
  };
}

export async function getDashboardLiveSnapshot(
  client: DatabaseClient,
  focusCrewCode?: string,
): Promise<DashboardLiveResponse> {
  const [crewResponse, readinessResponse, latestRunResult, latestTelemetryResult, crewLookupResult] =
    await Promise.all([
      listCrewOverview(client),
      listReadinessScores(client, { limit: 48 }),
      client
        .from("ingestion_runs")
        .select(
          "id, status, source_label, started_at, completed_at, accepted_record_count, rejected_record_count, run_metadata",
        )
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from("normalized_readings")
        .select("captured_at")
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client.from("crew_members").select("id, crew_code, display_name"),
    ]);

  if (latestRunResult.error) {
    throw new Error(
      `[ingestion_runs] latest run select failed: ${latestRunResult.error.message}`,
    );
  }

  if (latestTelemetryResult.error) {
    throw new Error(
      `[normalized_readings] latest telemetry select failed: ${latestTelemetryResult.error.message}`,
    );
  }

  if (crewLookupResult.error) {
    throw new Error(
      `[crew_members] dashboard event lookup failed: ${crewLookupResult.error.message}`,
    );
  }

  const crewById = buildCrewMap(crewLookupResult.data ?? []);
  const latestRun = latestRunResult.data as LatestIngestionRunRow | null;
  const currentRunEvents = latestRun
    ? await getDetectedEventsForIngestionRun(client, latestRun.id, crewById)
    : [];
  const currentEventByCrewCode = new Map(
    currentRunEvents
      .filter(
        (event): event is typeof currentRunEvents[number] & { crewCode: string } =>
          event.crewCode !== null,
      )
      .map((event) => [event.crewCode, event]),
  );

  const crews = sortCrewByRisk(
    crewResponse.crews.map((crew) => ({
      ...crew,
      latestEvent: currentEventByCrewCode.get(crew.crewCode)
        ? {
            eventType: currentEventByCrewCode.get(crew.crewCode)!.eventType,
            severity: currentEventByCrewCode.get(crew.crewCode)!.severity,
            startedAt: currentEventByCrewCode.get(crew.crewCode)!.startedAt,
          }
        : null,
    })),
  );
  const focusCrew =
    (focusCrewCode
      ? crews.find((crew) => crew.crewCode === focusCrewCode) ?? null
      : null) ??
    crews[0] ??
    null;

  let focusTelemetry: DashboardLiveResponse["focusTelemetry"] = null;

  if (focusCrew) {
    const crewLookupResult = await client
      .from("crew_members")
      .select("id, crew_code, display_name")
      .eq("crew_code", focusCrew.crewCode)
      .maybeSingle();

    if (crewLookupResult.error) {
      throw new Error(
        `[crew_members] focus crew lookup failed: ${crewLookupResult.error.message}`,
      );
    }

    if (crewLookupResult.data) {
      const telemetryResult = await client
        .from("normalized_readings")
        .select(
          "signal_type, normalized_value, normalized_unit, confidence_score, captured_at",
        )
        .eq("crew_member_id", crewLookupResult.data.id)
        .order("captured_at", { ascending: false })
        .limit(TELEMETRY_POINT_FETCH_LIMIT);

      if (telemetryResult.error) {
        throw new Error(
          `[normalized_readings] focus telemetry select failed: ${telemetryResult.error.message}`,
        );
      }

      focusTelemetry = buildTelemetryBundle(
        crewLookupResult.data.crew_code,
        crewLookupResult.data.display_name,
        (telemetryResult.data ?? []) as Array<{
          captured_at: string;
          confidence_score: number;
          normalized_unit: string;
          normalized_value: number;
          signal_type: SignalTypeValue;
        }>,
      );
    }
  }

  return {
    crews,
    events: currentRunEvents,
    fleetTrend: buildFleetTrend(readinessResponse.scores),
    focusCrewCode: focusCrew?.crewCode ?? null,
    focusTelemetry,
    telemetryStatus: {
      latestEventAt: currentRunEvents[0]?.startedAt ?? null,
      latestIngestionRun: latestRun
        ? {
            acceptedRecordCount: latestRun.accepted_record_count,
            completedAt: latestRun.completed_at,
            id: latestRun.id,
            rejectedRecordCount: latestRun.rejected_record_count,
            scenarioKinds: getScenarioKindsFromRunMetadata(latestRun.run_metadata),
            seed: getSeedFromRunMetadata(latestRun.run_metadata),
            sourceLabel: latestRun.source_label,
            startedAt: latestRun.started_at,
            status: latestRun.status,
          }
        : null,
      latestScoreAt: readinessResponse.scores[0]?.calculatedAt ?? null,
      latestTelemetryAt: latestTelemetryResult.data?.captured_at ?? null,
      monitoredCrewCount: crews.filter((crew) => crew.latestReadiness !== null).length,
      pollingIntervalMs: 6000,
      totalCrewCount: crews.length,
    },
  };
}

export async function getAdminObservabilitySnapshot(
  client: DatabaseClient,
): Promise<AdminObservabilityResponse> {
  const cutoffTimeMs = Date.now() - 24 * 60 * 60 * 1000;

  const [
    environment,
    dependencies,
    crewLookupResult,
    recentRunsResult,
    recentLogsResult,
    readinessResult,
    normalizedResult,
    eventsResult,
    latestSummaryResult,
    aiSummaryJobsResult,
  ] = await Promise.all([
    Promise.resolve(getEnvironmentSummary()),
    getDependencyReports(),
    client.from("crew_members").select("id, crew_code, display_name"),
    client
      .from("ingestion_runs")
      .select(
        "id, source_label, run_kind, status, started_at, completed_at, input_record_count, accepted_record_count, rejected_record_count, error_summary, run_metadata",
      )
      .order("started_at", { ascending: false })
      .limit(18),
    client
      .from("system_logs")
      .select(
        "id, created_at, level, component, event_type, message, related_table_name, related_record_id, details",
      )
      .order("created_at", { ascending: false })
      .limit(60),
    client
      .from("readiness_scores")
      .select("crew_member_id, confidence_modifier, calculated_at")
      .order("calculated_at", { ascending: false })
      .limit(300),
    client
      .from("normalized_readings")
      .select("crew_member_id, confidence_score, captured_at")
      .order("captured_at", { ascending: false })
      .limit(2000),
    client
      .from("detected_events")
      .select("severity, started_at")
      .order("started_at", { ascending: false })
      .limit(400),
    client
      .from("ai_summaries")
      .select("generated_at")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("ai_summary_jobs")
      .select(
        "id, crew_member_id, readiness_score_id, status, attempt_count, last_error, enqueued_at, started_at, completed_at",
      )
      .order("enqueued_at", { ascending: false })
      .limit(200),
  ]);

  if (crewLookupResult.error) {
    throw new Error(
      `[crew_members] admin crew lookup failed: ${crewLookupResult.error.message}`,
    );
  }

  if (recentRunsResult.error) {
    throw new Error(
      `[ingestion_runs] admin run select failed: ${recentRunsResult.error.message}`,
    );
  }

  if (recentLogsResult.error) {
    throw new Error(
      `[system_logs] admin log select failed: ${recentLogsResult.error.message}`,
    );
  }

  if (readinessResult.error) {
    throw new Error(
      `[readiness_scores] admin readiness select failed: ${readinessResult.error.message}`,
    );
  }

  if (normalizedResult.error) {
    throw new Error(
      `[normalized_readings] admin telemetry select failed: ${normalizedResult.error.message}`,
    );
  }

  if (eventsResult.error) {
    throw new Error(
      `[detected_events] admin event select failed: ${eventsResult.error.message}`,
    );
  }

  if (latestSummaryResult.error) {
    throw new Error(
      `[ai_summaries] admin latest summary select failed: ${latestSummaryResult.error.message}`,
    );
  }

  if (aiSummaryJobsResult.error) {
    throw new Error(
      `[ai_summary_jobs] admin summary job select failed: ${aiSummaryJobsResult.error.message}`,
    );
  }

  const crewById = buildCrewMap(crewLookupResult.data ?? []);
  const recentRuns = (recentRunsResult.data ?? []).map((row) => ({
    acceptedRecordCount: row.accepted_record_count,
    completedAt: row.completed_at,
    errorSummary: row.error_summary,
    id: row.id,
    inputRecordCount: row.input_record_count,
    rejectedRecordCount: row.rejected_record_count,
    runKind: row.run_kind,
    scenarioKinds: getScenarioKindsFromRunMetadata(row.run_metadata),
    seed: getSeedFromRunMetadata(row.run_metadata),
    sourceLabel: row.source_label,
    startedAt: row.started_at,
    status: row.status,
  }));
  const runsLast24Hours = recentRuns.filter((run) =>
    isWithinLast24Hours(run.startedAt, cutoffTimeMs),
  );
  const totalAccepted = runsLast24Hours.reduce(
    (sum, run) => sum + run.acceptedRecordCount,
    0,
  );
  const totalInput = runsLast24Hours.reduce(
    (sum, run) => sum + run.inputRecordCount,
    0,
  );

  const recentLogs = (recentLogsResult.data ?? []).map((row) => ({
    component: row.component,
    createdAt: row.created_at,
    details: row.details,
    eventType: row.event_type,
    id: row.id,
    level: row.level,
    message: row.message,
    relatedRecordId: row.related_record_id,
    relatedTableName: row.related_table_name,
  }));
  const logsLast24Hours = recentLogs.filter((log) =>
    isWithinLast24Hours(log.createdAt, cutoffTimeMs),
  );

  const readinessRows = (readinessResult.data ?? []).filter((row) =>
    isWithinLast24Hours(row.calculated_at, cutoffTimeMs),
  );
  const normalizedRows = (normalizedResult.data ?? []).filter((row) =>
    isWithinLast24Hours(row.captured_at, cutoffTimeMs),
  );
  const eventsLast24Hours = (eventsResult.data ?? []).filter((row) =>
    isWithinLast24Hours(row.started_at, cutoffTimeMs),
  );

  const aiSummaryJobs = (aiSummaryJobsResult.data ?? []) as AdminSummaryJobRow[];
  const recentFailedJobs: AdminSummaryJobItem[] = aiSummaryJobs
    .filter((job) => job.status === "failed")
    .slice(0, 8)
    .map((job) => ({
      attemptCount: job.attempt_count,
      completedAt: job.completed_at,
      crewCode: crewById.get(job.crew_member_id)?.crewCode ?? null,
      crewDisplayName: crewById.get(job.crew_member_id)?.displayName ?? null,
      enqueuedAt: job.enqueued_at,
      id: job.id,
      lastError: job.last_error,
      readinessScoreId: job.readiness_score_id,
      startedAt: job.started_at,
      status: job.status,
    }));

  return {
    aiSummaryQueue: {
      counts: {
        completed: aiSummaryJobs.filter((job) => job.status === "completed")
          .length,
        failed: aiSummaryJobs.filter((job) => job.status === "failed").length,
        pending: aiSummaryJobs.filter((job) => job.status === "pending").length,
        running: aiSummaryJobs.filter((job) => job.status === "running").length,
      },
      recentFailedJobs,
      stalePendingCount: aiSummaryJobs.filter((job) => {
        if (job.status !== "pending") {
          return false;
        }

        return Date.parse(job.enqueued_at) < Date.now() - 5 * 60 * 1000;
      }).length,
    },
    dataQuality: {
      affectedCrewCount: new Set(
        readinessRows
          .filter((row) => row.confidence_modifier < AI_SUMMARY_CONFIDENCE_THRESHOLD)
          .map((row) => row.crew_member_id),
      ).size,
      averageReadinessConfidencePercent:
        average(
          readinessRows.map((row) => row.confidence_modifier * 100),
        ) == null
          ? null
          : roundTo(
              average(readinessRows.map((row) => row.confidence_modifier * 100))!,
              1,
            ),
      eventCountsLast24Hours: {
        high: eventsLast24Hours.filter((event) => event.severity === "high")
          .length,
        low: eventsLast24Hours.filter((event) => event.severity === "low")
          .length,
        medium: eventsLast24Hours.filter((event) => event.severity === "medium")
          .length,
      },
      lowConfidenceReadinessCount: readinessRows.filter(
        (row) => row.confidence_modifier < AI_SUMMARY_CONFIDENCE_THRESHOLD,
      ).length,
      lowConfidenceTelemetryRatePercent:
        normalizedRows.length === 0
          ? null
          : roundTo(
              (normalizedRows.filter((row) => row.confidence_score < 0.75).length /
                normalizedRows.length) *
                100,
              1,
            ),
    },
    failureLogs: {
      recentLogs: recentLogs.filter(
        (log) => log.level === "error" || log.level === "warn",
      ),
      totalsLast24Hours: {
        debug: logsLast24Hours.filter((log) => log.level === "debug").length,
        error: logsLast24Hours.filter((log) => log.level === "error").length,
        info: logsLast24Hours.filter((log) => log.level === "info").length,
        warn: logsLast24Hours.filter((log) => log.level === "warn").length,
      },
    },
    generatedAt: new Date().toISOString(),
    ingestionMonitoring: {
      recentRuns,
      totalsLast24Hours: {
        acceptedRecordCount: totalAccepted,
        completed: runsLast24Hours.filter((run) => run.status === "completed")
          .length,
        failed: runsLast24Hours.filter((run) => run.status === "failed").length,
        partial: runsLast24Hours.filter(
          (run) => run.status === "partially_completed",
        ).length,
        pending: runsLast24Hours.filter((run) => run.status === "pending").length,
        rejectedRecordCount: runsLast24Hours.reduce(
          (sum, run) => sum + run.rejectedRecordCount,
          0,
        ),
        running: runsLast24Hours.filter((run) => run.status === "running").length,
        successRatePercent:
          totalInput === 0 ? null : roundTo((totalAccepted / totalInput) * 100, 1),
        totalRuns: runsLast24Hours.length,
      },
    },
    systemHealth: {
      dependencies,
      environment,
      latestActivity: {
        latestIngestionAt: recentRuns[0]?.startedAt ?? null,
        latestLogAt: recentLogs[0]?.createdAt ?? null,
        latestScoreAt: readinessRows[0]?.calculated_at ?? null,
        latestSummaryAt: latestSummaryResult.data?.generated_at ?? null,
        latestTelemetryAt: normalizedRows[0]?.captured_at ?? null,
      },
    },
  };
}

export async function listCrewOverviewWithServiceRole() {
  const client = createSupabaseServiceRoleClient();
  return listCrewOverview(client);
}

export async function getCrewDetailWithServiceRole(crewCode: string) {
  const client = createSupabaseServiceRoleClient();
  return getCrewDetail(client, crewCode);
}

export async function listEventsWithServiceRole(filters: EventQueryFilters = {}) {
  const client = createSupabaseServiceRoleClient();
  return listEvents(client, filters);
}

export async function listReadinessScoresWithServiceRole(
  filters: ReadinessScoreFilters = {},
) {
  const client = createSupabaseServiceRoleClient();
  return listReadinessScores(client, filters);
}

export async function listSummariesWithServiceRole(filters: SummaryFilters = {}) {
  const client = createSupabaseServiceRoleClient();
  return listSummaries(client, filters);
}

export async function getDashboardLiveSnapshotWithServiceRole(focusCrewCode?: string) {
  const client = createSupabaseServiceRoleClient();
  return getDashboardLiveSnapshot(client, focusCrewCode);
}

export async function getAdminObservabilitySnapshotWithServiceRole() {
  const client = createSupabaseServiceRoleClient();
  return getAdminObservabilitySnapshot(client);
}
