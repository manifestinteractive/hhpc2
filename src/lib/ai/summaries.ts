import {
  formatFactorLabel,
  getSignalLabel,
} from "@/lib/dashboard";
import {
  aiSummariesRepository,
  createSupabaseServiceRoleClient,
  summaryReviewsRepository,
  systemLogsRepository,
  type DatabaseClient,
  type Json,
  type TableEnum,
} from "@/lib/db";
import { getSummaryProvider } from "@/lib/ai/provider";
import type { CrewSummaryInputContext } from "@/lib/ai/types";
import { getServerEnv } from "@/lib/env/server";
import { listSummaries } from "@/lib/api/query";
import type { SummaryDetail } from "@/types/api";

const SUMMARY_CONFIDENCE_THRESHOLD = 0.8;
const DEFAULT_SUMMARY_JOB_BATCH_SIZE = 8;
const MAX_SUMMARY_JOB_ATTEMPTS = 2;

type QueueableCrewSummaryScore = {
  confidenceModifier: number;
  crewMemberId: number;
  readinessScoreId: number;
};

type SummaryJobRow = {
  attempt_count: number;
  crew_member_id: number;
  id: number;
  last_error: string | null;
  readiness_score_id: number;
  status: "pending" | "running" | "completed" | "failed";
};

type CrewSummaryScoreRow = {
  calculated_at: string;
  composite_score: number;
  confidence_modifier: number;
  crew_member_id: number;
  id: number;
  score_components: Json;
  score_explanation: Json;
  window_ended_at: string;
  window_started_at: string;
};

type CrewReadinessBand = "critical" | "stable" | "watch";

function isSummaryGenerationEnabled() {
  return Boolean(getServerEnv().OPENAI_API_KEY);
}

function asObject(value: Json): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function getComponentScore(scoreComponents: unknown, factor: string) {
  if (
    !scoreComponents ||
    typeof scoreComponents !== "object" ||
    Array.isArray(scoreComponents)
  ) {
    return null;
  }

  const component = (scoreComponents as Record<string, unknown>)[factor];

  if (!component || typeof component !== "object" || Array.isArray(component)) {
    return null;
  }

  const score = (component as Record<string, unknown>).score;
  return typeof score === "number" ? Math.round(score) : null;
}

function formatEventType(eventType: string) {
  return eventType.replaceAll("_", " ");
}

function getReadinessBand(score: number | null): CrewReadinessBand {
  if (score == null) {
    return "watch";
  }

  if (score < 55) {
    return "critical";
  }

  if (score < 75) {
    return "watch";
  }

  return "stable";
}

function getConfidenceState(confidenceModifier: number | null) {
  if (confidenceModifier == null || confidenceModifier < SUMMARY_CONFIDENCE_THRESHOLD) {
    return "insufficient" as const;
  }

  if (confidenceModifier < 0.9) {
    return "use_caution" as const;
  }

  return "actionable" as const;
}

function getRecentSignalConfidencePercent(signalSnapshots: Array<{ confidencePercent: number }>) {
  if (signalSnapshots.length === 0) {
    return null;
  }

  return Math.round(
    signalSnapshots.reduce((sum, signal) => sum + signal.confidencePercent, 0) /
      signalSnapshots.length,
  );
}

function inferCrewCondition(input: {
  dominantFactorKeys: string[];
  recentEvents: Array<{
    eventType: string;
    severity: "high" | "low" | "medium";
  }>;
  readinessBand: CrewReadinessBand;
  signalSnapshots: Array<{
    confidencePercent: number;
    label: string;
  }>;
}) {
  const eventTypes = new Set(input.recentEvents.map((event) => event.eventType));
  const highSensorEventCount = input.recentEvents.filter(
    (event) =>
      event.eventType === "sensor_reliability_issue" && event.severity !== "low",
  ).length;
  const signalConfidencePercent = getRecentSignalConfidencePercent(
    input.signalSnapshots,
  );
  const hasSensorConfidenceConcern =
    signalConfidencePercent != null && signalConfidencePercent < 82;
  const hasSensorConcern =
    highSensorEventCount > 0 ||
    input.dominantFactorKeys.includes("data_quality") ||
    hasSensorConfidenceConcern;
  const hasCardiovascularConcern =
    eventTypes.has("elevated_heart_rate") ||
    eventTypes.has("suppressed_heart_rate_variability") ||
    input.dominantFactorKeys.includes("cardiovascular");
  const hasRecoveryConcern =
    eventTypes.has("sleep_deficit") ||
    eventTypes.has("poor_sleep_quality") ||
    input.dominantFactorKeys.includes("recovery");
  const hasThermalConcern =
    input.dominantFactorKeys.includes("thermal_stability");

  if (hasSensorConcern) {
    return {
      dataTrust:
        "Telemetry confidence is degraded, so the latest score should be reviewed with caution.",
      likelyCondition: "sensor reliability issue",
      primaryConcern:
        "The main concern is degraded sensor reliability rather than a purely physiological decline.",
    };
  }

  if (hasCardiovascularConcern && hasRecoveryConcern) {
    return {
      dataTrust: "Telemetry confidence is strong enough to support action on this trend.",
      likelyCondition: "fatigue with cardiovascular strain",
      primaryConcern:
        "Weak recovery and cardiovascular strain are combining to drag readiness down.",
    };
  }

  if (hasRecoveryConcern) {
    return {
      dataTrust: "Telemetry confidence is strong enough to support action on this trend.",
      likelyCondition: "fatigue or weak recovery",
      primaryConcern:
        "Poor sleep and weak recovery markers are the clearest reason readiness is slipping.",
    };
  }

  if (hasCardiovascularConcern) {
    return {
      dataTrust: "Telemetry confidence is strong enough to support action on this trend.",
      likelyCondition: "acute stress pattern",
      primaryConcern:
        "Cardiovascular strain is the clearest current concern and is consistent with acute stress.",
    };
  }

  if (hasThermalConcern) {
    return {
      dataTrust: "Telemetry confidence is strong enough to support action on this trend.",
      likelyCondition: "thermal strain",
      primaryConcern:
        "Thermal stability is the dominant concern in the current readiness drop.",
    };
  }

  if (input.readinessBand === "stable") {
    return {
      dataTrust: "Telemetry confidence is strong enough to treat the current stable state as reliable.",
      likelyCondition: "stable operation",
      primaryConcern:
        "No immediate concern stands out in the latest scored telemetry.",
    };
  }

  return {
    dataTrust: "Telemetry confidence is acceptable for review, but the pattern is mixed.",
    likelyCondition: "mixed readiness pressure",
    primaryConcern:
      "Several smaller pressures are affecting readiness without a single dominant incident pattern.",
  };
}

function getCrewSummaryQualityIssues(
  input: CrewSummaryInputContext,
  summaryText: string,
) {
  const trimmed = summaryText.trim();
  const issues: string[] = [];
  const lowercase = trimmed.toLowerCase();
  const numericTokens = trimmed.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];

  if (trimmed.length < 30) {
    issues.push("the summary is too short to explain what is happening");
  }

  if (!/[.!?]$/.test(trimmed)) {
    issues.push("the summary must end as a complete sentence");
  }

  if (/\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    issues.push("do not include timestamps");
  }

  if (numericTokens.length > 3) {
    issues.push("do not recite raw numbers or percentages");
  }

  if (
    [
      "confidence modifier",
      "latest readiness composite score",
      "dominant factor scores",
      "latest telemetry at",
      "calculated ",
      "call sign",
    ].some((phrase) => lowercase.includes(phrase))
  ) {
    issues.push("the summary reads like a database recap instead of an explanation");
  }

  if (lowercase.startsWith(input.crew.displayName.toLowerCase())) {
    issues.push("do not start by repeating the crew member name");
  }

  const expectedKeywords =
    input.derivedAssessment.likelyCondition === "sensor reliability issue"
      ? ["sensor", "telemetry", "data quality", "confidence"]
      : input.derivedAssessment.likelyCondition === "acute stress pattern"
        ? ["stress", "strain", "cardiovascular", "heart rate", "variability"]
        : input.derivedAssessment.likelyCondition === "fatigue or weak recovery" ||
            input.derivedAssessment.likelyCondition ===
              "fatigue with cardiovascular strain"
          ? ["fatigue", "recovery", "sleep", "strain"]
          : input.derivedAssessment.likelyCondition === "thermal strain"
            ? ["thermal", "temperature", "heat"]
            : input.derivedAssessment.likelyCondition === "stable operation"
              ? ["stable", "no immediate concern", "no urgent concern", "ready"]
              : ["concern", "pressure", "strain", "review", "watch"];

  if (!expectedKeywords.some((keyword) => lowercase.includes(keyword))) {
    issues.push("explicitly explain the operational concern or stable state");
  }

  return issues;
}

async function getLatestSummaryByScope(
  client: DatabaseClient,
  scopeKind: "crew_member" | "fleet",
  crewCode?: string,
): Promise<SummaryDetail | null> {
  const result = await listSummaries(client, {
    crewCode,
    limit: 1,
    scopeKind,
  });

  return result.summaries[0] ?? null;
}

function getDominantFactorKeys(
  scoreExplanation: Json,
  scoreComponents: Json,
): string[] {
  const dominantFactors = asObject(scoreExplanation).dominant_factors;

  if (Array.isArray(dominantFactors)) {
    return dominantFactors
      .filter((value): value is string => typeof value === "string")
      .slice(0, 3);
  }

  const componentEntries = Object.entries(asObject(scoreComponents))
    .map(([key, value]) => {
      const score = getComponentScore({ [key]: value }, key);
      return { key, score };
    })
    .filter(
      (entry): entry is { key: string; score: number } =>
        entry.score !== null,
    )
    .sort((left, right) => left.score - right.score);

  return componentEntries.slice(0, 3).map((entry) => entry.key);
}

async function buildCrewSummaryContextForReadinessScore(
  client: DatabaseClient,
  readinessScoreId: number,
) {
  const readinessResult = await client
    .from("readiness_scores")
    .select(
      "id, crew_member_id, calculated_at, composite_score, confidence_modifier, score_components, score_explanation, window_started_at, window_ended_at",
    )
    .eq("id", readinessScoreId)
    .maybeSingle();

  if (readinessResult.error) {
    throw new Error(
      `[readiness_scores] summary source lookup failed: ${readinessResult.error.message}`,
    );
  }

  if (!readinessResult.data) {
    throw new Error(
      `Readiness score ${readinessScoreId} was not found for summary generation.`,
    );
  }

  const readiness = readinessResult.data as CrewSummaryScoreRow;

  const [crewResult, eventsResult, telemetryResult] = await Promise.all([
    client
      .from("crew_members")
      .select("crew_code, display_name, call_sign, role_title")
      .eq("id", readiness.crew_member_id)
      .maybeSingle(),
    client
      .from("detected_events")
      .select("event_type, severity, explanation, started_at, ended_at")
      .eq("crew_member_id", readiness.crew_member_id)
      .lte("started_at", readiness.window_ended_at)
      .order("started_at", { ascending: false })
      .limit(20),
    client
      .from("normalized_readings")
      .select(
        "signal_type, normalized_value, normalized_unit, confidence_score, captured_at",
      )
      .eq("crew_member_id", readiness.crew_member_id)
      .lte("captured_at", readiness.window_ended_at)
      .order("captured_at", { ascending: false })
      .limit(240),
  ]);

  if (crewResult.error) {
    throw new Error(
      `[crew_members] summary source crew lookup failed: ${crewResult.error.message}`,
    );
  }

  if (!crewResult.data) {
    throw new Error(
      `Crew member ${readiness.crew_member_id} was not found for summary generation.`,
    );
  }

  if (eventsResult.error) {
    throw new Error(
      `[detected_events] summary source event lookup failed: ${eventsResult.error.message}`,
    );
  }

  if (telemetryResult.error) {
    throw new Error(
      `[normalized_readings] summary source telemetry lookup failed: ${telemetryResult.error.message}`,
    );
  }

  const dominantFactors = getDominantFactorKeys(
    readiness.score_explanation,
    readiness.score_components,
  );
  const recentEvents = (eventsResult.data ?? [])
    .filter((event) => {
      if (!event.ended_at) {
        return event.started_at >= readiness.window_started_at;
      }

      return event.ended_at >= readiness.window_started_at;
    })
    .slice(0, 5);
  const latestSignalByType = new Map<
    string,
    {
      captured_at: string;
      confidence_score: number;
      normalized_unit: string;
      normalized_value: number;
      signal_type: string;
    }
  >();

  for (const row of telemetryResult.data ?? []) {
    if (!latestSignalByType.has(row.signal_type)) {
      latestSignalByType.set(row.signal_type, row);
    }
  }

  const latestTelemetryAt =
    (telemetryResult.data ?? [])
      .map((row) => row.captured_at)
      .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const readinessBand = getReadinessBand(readiness.composite_score);
  const confidencePercent = Math.round(readiness.confidence_modifier * 100);
  const confidenceState = getConfidenceState(readiness.confidence_modifier);
  const derivedAssessment = inferCrewCondition({
    dominantFactorKeys: dominantFactors,
    readinessBand,
    recentEvents: recentEvents.map((event) => ({
      eventType: event.event_type,
      severity: event.severity,
    })),
    signalSnapshots: [...latestSignalByType.values()]
      .sort((left, right) => left.signal_type.localeCompare(right.signal_type))
      .map((row) => ({
        confidencePercent: Math.round(row.confidence_score * 100),
        label: getSignalLabel(
          row.signal_type as
            | "heart_rate"
            | "heart_rate_variability"
            | "activity_level"
            | "temperature"
            | "sleep_duration"
            | "sleep_quality"
            | "custom",
        ),
      })),
  });

  return {
    crewCode: crewResult.data.crew_code,
    crewDisplayName: crewResult.data.display_name,
    crewMemberId: readiness.crew_member_id,
    inputContext: {
      crew: {
        callSign: crewResult.data.call_sign,
        crewCode: crewResult.data.crew_code,
        displayName: crewResult.data.display_name,
        roleTitle: crewResult.data.role_title,
      },
      derivedAssessment: {
        confidencePercent,
        confidenceState,
        dataTrust: derivedAssessment.dataTrust,
        highSeverityEventCount: recentEvents.filter((event) => event.severity === "high")
          .length,
        likelyCondition: derivedAssessment.likelyCondition,
        primaryConcern: derivedAssessment.primaryConcern,
        readinessBand,
      },
      dominantFactors: dominantFactors.map((factor) => ({
        label: formatFactorLabel(factor),
        score: getComponentScore(readiness.score_components, factor),
      })),
      generatedAt: new Date().toISOString(),
      latestReadiness: {
        calculatedAt: readiness.calculated_at,
        compositeScore: readiness.composite_score,
        confidenceModifier: readiness.confidence_modifier,
      },
      recentEvents: recentEvents.map((event) => ({
        eventType: formatEventType(event.event_type),
        explanation: event.explanation,
        severity: event.severity,
        startedAt: event.started_at,
      })),
      scopeKind: "crew_member",
      signalSnapshots: [...latestSignalByType.values()]
        .sort((left, right) => left.signal_type.localeCompare(right.signal_type))
        .map((row) => ({
          confidencePercent: Math.round(row.confidence_score * 100),
          label: getSignalLabel(
            row.signal_type as
              | "heart_rate"
              | "heart_rate_variability"
              | "activity_level"
              | "temperature"
              | "sleep_duration"
              | "sleep_quality"
              | "custom",
          ),
          normalizedUnit: row.normalized_unit,
          normalizedValue: row.normalized_value,
        })),
      telemetryWindow: {
        latestTelemetryAt,
        signalCount: latestSignalByType.size,
      },
    } satisfies CrewSummaryInputContext,
    readinessScoreId,
  };
}

async function createSummaryRecord(input: {
  client: DatabaseClient;
  crewMemberId: number;
  inputContext: CrewSummaryInputContext;
  readinessScoreId?: number | null;
}) {
  const provider = getSummaryProvider();
  let generated = await provider.generateSummary(input.inputContext);

  let qualityIssues = getCrewSummaryQualityIssues(
    input.inputContext,
    generated.summaryText,
  );

  if (qualityIssues.length > 0) {
    generated = await provider.generateSummary(input.inputContext, {
      qualityFeedback: qualityIssues,
    });
    qualityIssues = getCrewSummaryQualityIssues(
      input.inputContext,
      generated.summaryText,
    );

    if (qualityIssues.length > 0) {
      throw new Error(
        `Generated summary failed quality checks: ${qualityIssues.join("; ")}`,
      );
    }
  }

  const insertResult = await input.client
    .from("ai_summaries")
    .insert({
      crew_member_id: input.crewMemberId,
      model_name: generated.modelName,
      provider_name: generated.providerName,
      readiness_score_id: input.readinessScoreId ?? null,
      review_status: "pending",
      scope_kind: "crew_member",
      structured_input_context: input.inputContext,
      summary_text: generated.summaryText,
    })
    .select(
      "id, crew_member_id, readiness_score_id, summary_text, scope_kind, review_status, generated_at, provider_name, model_name, structured_input_context, reviewed_at",
    )
    .single();

  if (insertResult.error) {
    if (
      insertResult.error.code === "23505" &&
      input.readinessScoreId != null
    ) {
      const existingResult = await input.client
        .from("ai_summaries")
        .select(
          "id, crew_member_id, readiness_score_id, summary_text, scope_kind, review_status, generated_at, provider_name, model_name, structured_input_context, reviewed_at",
        )
        .eq("scope_kind", "crew_member")
        .eq("readiness_score_id", input.readinessScoreId)
        .maybeSingle();

      if (existingResult.error) {
        throw new Error(
          `[ai_summaries] reload after duplicate failed: ${existingResult.error.message}`,
        );
      }

      if (existingResult.data) {
        return existingResult.data;
      }
    }

    throw new Error(`[ai_summaries] create failed: ${insertResult.error.message}`);
  }

  await systemLogsRepository.create(input.client, {
    component: "ai_summary_generation",
    details: {
      model_name: generated.modelName,
      provider_name: generated.providerName,
      scope_kind: "crew_member",
      summary_id: insertResult.data.id,
    },
    event_type: "summary_generated",
    level: "info",
    message: "Generated crew_member AI summary.",
    related_record_id: insertResult.data.id,
    related_table_name: "ai_summaries",
  });

  return insertResult.data;
}

async function markSummaryJobStatus(
  client: DatabaseClient,
  jobId: number,
  values:
    | {
        completed_at: string;
        last_error: null;
        status: "completed";
      }
    | {
        completed_at: string;
        last_error: string;
        status: "failed";
      },
) {
  const result = await client
    .from("ai_summary_jobs")
    .update(values)
    .eq("id", jobId);

  if (result.error) {
    throw new Error(
      `[ai_summary_jobs] status update failed: ${result.error.message}`,
    );
  }
}

async function claimNextPendingSummaryJob(client: DatabaseClient) {
  const nextJobResult = await client
    .from("ai_summary_jobs")
    .select("id, crew_member_id, readiness_score_id, status, attempt_count, last_error")
    .eq("status", "pending")
    .order("enqueued_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextJobResult.error) {
    throw new Error(
      `[ai_summary_jobs] pending job lookup failed: ${nextJobResult.error.message}`,
    );
  }

  if (!nextJobResult.data) {
    return null;
  }

  const claimResult = await client
    .from("ai_summary_jobs")
    .update({
      attempt_count: nextJobResult.data.attempt_count + 1,
      last_error: null,
      started_at: new Date().toISOString(),
      status: "running",
    })
    .eq("id", nextJobResult.data.id)
    .eq("status", "pending")
    .select("id, crew_member_id, readiness_score_id, status, attempt_count, last_error")
    .maybeSingle();

  if (claimResult.error) {
    throw new Error(
      `[ai_summary_jobs] job claim failed: ${claimResult.error.message}`,
    );
  }

  return (claimResult.data ?? null) as SummaryJobRow | null;
}

async function processSummaryJob(
  client: DatabaseClient,
  job: SummaryJobRow,
) {
  const existingSummaryResult = await client
    .from("ai_summaries")
    .select(
      "id, crew_member_id, readiness_score_id, summary_text, scope_kind, review_status, generated_at, provider_name, model_name, structured_input_context, reviewed_at",
    )
    .eq("scope_kind", "crew_member")
    .eq("readiness_score_id", job.readiness_score_id)
    .maybeSingle();

  if (existingSummaryResult.error) {
    throw new Error(
      `[ai_summaries] existing summary lookup failed: ${existingSummaryResult.error.message}`,
    );
  }

  if (!existingSummaryResult.data) {
    const context = await buildCrewSummaryContextForReadinessScore(
      client,
      job.readiness_score_id,
    );

    await createSummaryRecord({
      client,
      crewMemberId: context.crewMemberId,
      inputContext: context.inputContext,
      readinessScoreId: context.readinessScoreId,
    });
  }

  await markSummaryJobStatus(client, job.id, {
    completed_at: new Date().toISOString(),
    last_error: null,
    status: "completed",
  });
}

export async function enqueueCrewSummaryJobsForScores(
  client: DatabaseClient,
  scores: QueueableCrewSummaryScore[],
) {
  if (!isSummaryGenerationEnabled()) {
    return { enqueuedCount: 0 };
  }

  const eligibleScores = scores.filter(
    (score) => score.confidenceModifier >= SUMMARY_CONFIDENCE_THRESHOLD,
  );

  if (eligibleScores.length === 0) {
    return { enqueuedCount: 0 };
  }

  const crewMemberIds = [...new Set(eligibleScores.map((score) => score.crewMemberId))];
  const readinessScoreIds = eligibleScores.map((score) => score.readinessScoreId);
  const [existingSummariesResult, jobsResult] = await Promise.all([
    client
      .from("ai_summaries")
      .select("readiness_score_id")
      .eq("scope_kind", "crew_member")
      .in("readiness_score_id", readinessScoreIds),
    client
      .from("ai_summary_jobs")
      .select("id, crew_member_id, readiness_score_id, status, attempt_count")
      .in("crew_member_id", crewMemberIds)
      .in("status", ["pending", "running", "failed"]),
  ]);

  if (existingSummariesResult.error) {
    throw new Error(
      `[ai_summaries] queue summary lookup failed: ${existingSummariesResult.error.message}`,
    );
  }

  if (jobsResult.error) {
    throw new Error(
      `[ai_summary_jobs] queue active job lookup failed: ${jobsResult.error.message}`,
    );
  }

  const summarizedScoreIds = new Set(
    (existingSummariesResult.data ?? [])
      .map((row) => row.readiness_score_id)
      .filter((value): value is number => value != null),
  );
  const jobsByScoreId = new Map(
    (jobsResult.data ?? []).map((row) => [row.readiness_score_id, row]),
  );
  const activeCrewIds = new Set(
    (jobsResult.data ?? [])
      .filter((row) => row.status === "pending" || row.status === "running")
      .map((row) => row.crew_member_id),
  );

  let enqueuedCount = 0;

  for (const score of eligibleScores) {
    if (summarizedScoreIds.has(score.readinessScoreId)) {
      continue;
    }

    const existingJob = jobsByScoreId.get(score.readinessScoreId);

    if (existingJob?.status === "pending" || existingJob?.status === "running") {
      continue;
    }

    if (existingJob?.status === "failed") {
      if (
        activeCrewIds.has(score.crewMemberId) ||
        existingJob.attempt_count >= MAX_SUMMARY_JOB_ATTEMPTS
      ) {
        continue;
      }

      const retryResult = await client
        .from("ai_summary_jobs")
        .update({
          completed_at: null,
          last_error: null,
          started_at: null,
          status: "pending",
        })
        .eq("id", existingJob.id)
        .eq("status", "failed");

      if (retryResult.error) {
        throw new Error(
          `[ai_summary_jobs] retry enqueue failed: ${retryResult.error.message}`,
        );
      }

      activeCrewIds.add(score.crewMemberId);
      enqueuedCount += 1;
      continue;
    }

    if (activeCrewIds.has(score.crewMemberId)) {
      continue;
    }

    const insertResult = await client
      .from("ai_summary_jobs")
      .insert({
        crew_member_id: score.crewMemberId,
        readiness_score_id: score.readinessScoreId,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        continue;
      }

      throw new Error(
        `[ai_summary_jobs] create failed: ${insertResult.error.message}`,
      );
    }

    activeCrewIds.add(score.crewMemberId);
    enqueuedCount += 1;
  }

  return { enqueuedCount };
}

async function backfillLatestCrewSummaryJobs(client: DatabaseClient) {
  if (!isSummaryGenerationEnabled()) {
    return { enqueuedCount: 0 };
  }

  const latestScoresResult = await client
    .from("readiness_scores")
    .select("id, crew_member_id, confidence_modifier, calculated_at")
    .order("calculated_at", { ascending: false })
    .limit(256);

  if (latestScoresResult.error) {
    throw new Error(
      `[readiness_scores] latest summary backfill lookup failed: ${latestScoresResult.error.message}`,
    );
  }

  const latestScoreByCrew = new Map<number, QueueableCrewSummaryScore>();

  for (const row of latestScoresResult.data ?? []) {
    if (!latestScoreByCrew.has(row.crew_member_id)) {
      latestScoreByCrew.set(row.crew_member_id, {
        confidenceModifier: row.confidence_modifier,
        crewMemberId: row.crew_member_id,
        readinessScoreId: row.id,
      });
    }
  }

  return enqueueCrewSummaryJobsForScores(client, [...latestScoreByCrew.values()]);
}

export async function processPendingSummaryJobs(
  client: DatabaseClient,
  batchSize = DEFAULT_SUMMARY_JOB_BATCH_SIZE,
) {
  if (!isSummaryGenerationEnabled()) {
    return {
      backfilledCount: 0,
      completedCount: 0,
      failedCount: 0,
      processedCount: 0,
    };
  }

  const { enqueuedCount: backfilledCount } = await backfillLatestCrewSummaryJobs(
    client,
  );

  let completedCount = 0;
  let failedCount = 0;
  let processedCount = 0;

  for (let index = 0; index < batchSize; index += 1) {
    const job = await claimNextPendingSummaryJob(client);

    if (!job) {
      break;
    }

    processedCount += 1;

    try {
      await processSummaryJob(client, job);
      completedCount += 1;
    } catch (error) {
      failedCount += 1;

      const message =
        error instanceof Error ? error.message : "Summary job failed.";

      await markSummaryJobStatus(client, job.id, {
        completed_at: new Date().toISOString(),
        last_error: message,
        status: "failed",
      });

      await systemLogsRepository.create(client, {
        component: "ai_summary_generation",
        details: {
          crew_member_id: job.crew_member_id,
          readiness_score_id: job.readiness_score_id,
        },
        event_type: "summary_generation_failed",
        level: "error",
        message,
        related_record_id: job.id,
        related_table_name: "ai_summary_jobs",
      });
    }
  }

  return {
    backfilledCount,
    completedCount,
    failedCount,
    processedCount,
  };
}

export async function processPendingSummaryJobsWithServiceRole(
  batchSize = DEFAULT_SUMMARY_JOB_BATCH_SIZE,
) {
  const client = createSupabaseServiceRoleClient();
  return processPendingSummaryJobs(client, batchSize);
}

export async function reviewSummary(input: {
  decision: Extract<
    TableEnum<"summary_review_status">,
    "approved" | "dismissed"
  >;
  reviewNotes?: string;
  summaryId: number;
}) {
  const client = createSupabaseServiceRoleClient();
  const existing = await aiSummariesRepository.getById(client, input.summaryId);

  if (!existing) {
    throw new Error(`AI summary ${input.summaryId} was not found.`);
  }

  const reviewedAt = new Date().toISOString();

  await aiSummariesRepository.update(client, input.summaryId, {
    review_status: input.decision,
    reviewed_at: reviewedAt,
  });

  await summaryReviewsRepository.create(client, {
    ai_summary_id: input.summaryId,
    decision: input.decision,
    review_metadata: {
      source: "dashboard_ui",
    },
    review_notes: input.reviewNotes ?? null,
    reviewer_display_name: "Demo reviewer",
    reviewer_user_id: null,
  });

  await systemLogsRepository.create(client, {
    component: "ai_summary_review",
    details: {
      decision: input.decision,
      summary_id: input.summaryId,
    },
    event_type: "summary_reviewed",
    level: "info",
    message: `Reviewed AI summary ${input.summaryId} as ${input.decision}.`,
    related_record_id: input.summaryId,
    related_table_name: "ai_summaries",
  });

  const summary = await getLatestSummaryByScope(
    client,
    existing.scope_kind,
    existing.crew_member_id
      ? (
          await client
            .from("crew_members")
            .select("crew_code")
            .eq("id", existing.crew_member_id)
            .maybeSingle()
        ).data?.crew_code
      : undefined,
  );

  if (!summary || summary.id !== input.summaryId) {
    throw new Error(
      "AI summary review succeeded but the updated summary could not be reloaded.",
    );
  }

  return summary;
}
