import { z } from "zod";
import { createSupabaseServiceRoleClient, type DatabaseClient, type Json } from "@/lib/db";
import type {
  CrewDetailResponse,
  CrewListResponse,
  EventListResponse,
  ReadinessScoreListResponse,
  SummaryListResponse,
} from "@/types/api";

const limitSchema = z.coerce.number().int().positive().max(100).default(25);

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
  limit?: number;
  reviewStatus?: "approved" | "dismissed" | "pending";
};

function getLimit(value: number | undefined) {
  return limitSchema.parse(value ?? 25);
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

  const eventsByCrew = new Map<number, (typeof recentEventsResult.data)>();

  for (const event of recentEventsResult.data ?? []) {
    const current = eventsByCrew.get(event.crew_member_id) ?? [];
    current.push(event);
    eventsByCrew.set(event.crew_member_id, current);
  }

  return {
    crews: crews.map((crew) => {
      const latestScore = latestScoreByCrew.get(crew.id) ?? null;
      const recentEvents = eventsByCrew.get(crew.id) ?? [];

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
              scoreVersion: latestScore.score_version,
            }
          : null,
        recentEventCounts: {
          high: recentEvents.filter((event) => event.severity === "high").length,
          low: recentEvents.filter((event) => event.severity === "low").length,
          medium: recentEvents.filter((event) => event.severity === "medium").length,
        },
        roleTitle: crew.role_title,
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
  const [readinessResult, eventsResult, normalizedResult] = await Promise.all([
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

  const latestReadiness = readinessResult.data?.[0] ?? null;
  const latestSignalByType = new Map<
    string,
    (typeof normalizedResult.data)[number]
  >();

  for (const row of normalizedResult.data ?? []) {
    if (!latestSignalByType.has(row.signal_type)) {
      latestSignalByType.set(row.signal_type, row);
    }
  }

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
      "id, crew_member_id, readiness_score_id, summary_text, scope_kind, review_status, generated_at, provider_name, model_name",
    )
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (filters.reviewStatus) {
    query = query.eq("review_status", filters.reviewStatus);
  }

  const summariesResult = await query;

  if (summariesResult.error) {
    throw new Error(`[ai_summaries] list failed: ${summariesResult.error.message}`);
  }

  return {
    summaries: (summariesResult.data ?? []).map((row) => {
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
        scopeKind: row.scope_kind,
        summaryText: row.summary_text,
      };
    }),
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
