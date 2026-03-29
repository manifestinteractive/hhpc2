import { execFileSync } from "node:child_process";
import {
  aiSummariesRepository,
  createSupabaseServiceRoleClient,
  crewMembersRepository,
  detectedEventsRepository,
  ingestionRunsRepository,
  normalizedReadingsRepository,
  rawReadingsRepository,
  readinessScoresRepository,
  sensorStreamsRepository,
  summaryReviewsRepository,
  systemLogsRepository,
  type DatabaseClient,
} from "@/lib/db";

type LocalSupabaseStatus = {
  API_URL: string;
  SERVICE_ROLE_KEY: string;
};

function getLocalSupabaseStatus(): LocalSupabaseStatus {
  const raw = execFileSync("supabase", ["status", "-o", "json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Could not parse Supabase status output as JSON.");
  }

  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as LocalSupabaseStatus;

  if (!parsed.API_URL || !parsed.SERVICE_ROLE_KEY) {
    throw new Error(
      "Local Supabase status did not expose API_URL and SERVICE_ROLE_KEY.",
    );
  }

  return parsed;
}

async function cleanup(client: DatabaseClient, ids: Record<string, number>) {
  if (ids.systemLogId) {
    await systemLogsRepository.delete(client, ids.systemLogId);
  }

  if (ids.summaryReviewId) {
    await summaryReviewsRepository.delete(client, ids.summaryReviewId);
  }

  if (ids.aiSummaryId) {
    await aiSummariesRepository.delete(client, ids.aiSummaryId);
  }

  if (ids.readinessScoreId) {
    await readinessScoresRepository.delete(client, ids.readinessScoreId);
  }

  if (ids.detectedEventId) {
    await detectedEventsRepository.delete(client, ids.detectedEventId);
  }

  if (ids.normalizedReadingId) {
    await normalizedReadingsRepository.delete(client, ids.normalizedReadingId);
  }

  if (ids.rawReadingId) {
    await rawReadingsRepository.delete(client, ids.rawReadingId);
  }

  if (ids.ingestionRunId) {
    await ingestionRunsRepository.delete(client, ids.ingestionRunId);
  }

  if (ids.sensorStreamId) {
    await sensorStreamsRepository.delete(client, ids.sensorStreamId);
  }
}

async function main() {
  const { API_URL, SERVICE_ROLE_KEY } = getLocalSupabaseStatus();
  const client = createSupabaseServiceRoleClient({
    key: SERVICE_ROLE_KEY,
    url: API_URL,
  });
  const ids: Record<string, number> = {};

  const crewMembers = await crewMembersRepository.list(
    client,
    { is_active: true },
    { ascending: true, limit: 1, orderBy: "sort_order" },
  );
  const crewMember = crewMembers.at(0);

  if (!crewMember) {
    throw new Error("No seeded crew member found for persistence validation.");
  }

  try {
    const sensorStream = await sensorStreamsRepository.create(client, {
      crew_member_id: crewMember.id,
      display_name: "Validation Heart Rate Stream",
      signal_type: "heart_rate",
      source_key: `validation-heart-rate-${Date.now()}`,
      source_vendor: "persistence-smoke",
      stream_metadata: { source: "persistence-smoke" },
      unit: "bpm",
    });
    ids.sensorStreamId = sensorStream.id;

    const ingestionRun = await ingestionRunsRepository.create(client, {
      accepted_record_count: 1,
      input_record_count: 1,
      rejected_record_count: 0,
      run_kind: "simulation",
      run_metadata: { source: "persistence-smoke" },
      source_label: "persistence-smoke",
      status: "completed",
    });
    ids.ingestionRunId = ingestionRun.id;

    const capturedAt = new Date().toISOString();
    const rawReading = await rawReadingsRepository.create(client, {
      captured_at: capturedAt,
      crew_member_id: crewMember.id,
      ingestion_run_id: ingestionRun.id,
      raw_unit: "bpm",
      raw_value: 61.2,
      sensor_stream_id: sensorStream.id,
      signal_type: "heart_rate",
      source_identifier: `persistence-smoke-${Date.now()}`,
      source_metadata: { source: "persistence-smoke" },
      source_payload: { source: "persistence-smoke", value: 61.2 },
      source_signal_type: "heart_rate",
    });
    ids.rawReadingId = rawReading.id;

    const normalizedReading = await normalizedReadingsRepository.create(client, {
      captured_at: capturedAt,
      confidence_score: 0.98,
      crew_member_id: crewMember.id,
      normalization_version: "persistence-smoke",
      normalized_unit: "bpm",
      normalized_value: 61.2,
      processing_metadata: { source: "persistence-smoke" },
      raw_reading_id: rawReading.id,
      sensor_stream_id: sensorStream.id,
      signal_type: "heart_rate",
      source_reading_count: 1,
      source_window_ended_at: capturedAt,
      source_window_started_at: capturedAt,
    });
    ids.normalizedReadingId = normalizedReading.id;

    const detectedEvent = await detectedEventsRepository.create(client, {
      confidence_score: 0.8,
      crew_member_id: crewMember.id,
      event_type: "validation-anomaly",
      evidence: { normalized_reading_id: normalizedReading.id },
      explanation: "Validation event for persistence smoke testing.",
      normalized_reading_id: normalizedReading.id,
      primary_signal_type: "heart_rate",
      rule_id: "persistence-smoke",
      rule_version: "1.0.0",
      sensor_stream_id: sensorStream.id,
      severity: "low",
      started_at: capturedAt,
    });
    ids.detectedEventId = detectedEvent.id;

    const readinessScore = await readinessScoresRepository.create(client, {
      composite_score: 87.5,
      confidence_modifier: 0.95,
      crew_member_id: crewMember.id,
      score_components: {
        heart_rate: 87.5,
      },
      score_explanation: {
        events: [detectedEvent.id],
        summary: "Validation score for persistence smoke testing.",
      },
      score_version: "persistence-smoke",
      window_ended_at: capturedAt,
      window_started_at: capturedAt,
    });
    ids.readinessScoreId = readinessScore.id;

    const aiSummary = await aiSummariesRepository.create(client, {
      crew_member_id: crewMember.id,
      model_name: "gpt-5.4",
      provider_name: "openai",
      readiness_score_id: readinessScore.id,
      structured_input_context: {
        readiness_score_id: readinessScore.id,
      },
      summary_text: "Validation summary for persistence smoke testing.",
    });
    ids.aiSummaryId = aiSummary.id;

    const reviewedAt = new Date().toISOString();
    const summaryReview = await summaryReviewsRepository.create(client, {
      ai_summary_id: aiSummary.id,
      decision: "approved",
      review_metadata: {
        source: "persistence-smoke",
      },
      reviewer_display_name: "Persistence Smoke Test",
    });
    ids.summaryReviewId = summaryReview.id;

    await aiSummariesRepository.update(client, aiSummary.id, {
      review_status: "approved",
      reviewed_at: reviewedAt,
    });

    const systemLog = await systemLogsRepository.create(client, {
      component: "persistence-smoke",
      details: {
        crew_member_id: crewMember.id,
        raw_reading_id: rawReading.id,
      },
      event_type: "persistence-validation",
      level: "info",
      message: "Persistence validation completed successfully.",
      related_record_id: readinessScore.id,
      related_table_name: "readiness_scores",
    });
    ids.systemLogId = systemLog.id;

    const persistedSummary = await aiSummariesRepository.getById(client, aiSummary.id);

    if (!persistedSummary || persistedSummary.review_status !== "approved") {
      throw new Error("AI summary review status did not persist correctly.");
    }

    const persistedReview = await summaryReviewsRepository.getById(
      client,
      summaryReview.id,
    );

    if (!persistedReview || persistedReview.decision !== "approved") {
      throw new Error("Summary review was not written correctly.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          crewMemberId: crewMember.id,
          validated: ids,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup(client, ids);
  }
}

void main();
