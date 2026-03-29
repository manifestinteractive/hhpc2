import { execFileSync } from "node:child_process";
import { createSupabaseServiceRoleClient, type DatabaseClient } from "@/lib/db";
import {
  calculateReadinessScoresForIngestionRun,
  detectEventsForIngestionRun,
  ingestReadings,
  normalizeIngestionRun,
} from "@/lib/processing";
import { generateSimulationRun } from "@/lib/simulation";

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

async function cleanup(
  client: DatabaseClient,
  ingestionRunId: number,
  normalizationVersion: string,
  ruleVersion: string,
  scoreVersion: string,
) {
  const { data: rawRows } = await client
    .from("raw_readings")
    .select("id")
    .eq("ingestion_run_id", ingestionRunId);
  const rawReadingIds = (rawRows ?? []).map((row) => row.id);

  if (rawReadingIds.length > 0) {
    const { data: normalizedRows } = await client
      .from("normalized_readings")
      .select("id")
      .eq("normalization_version", normalizationVersion)
      .in("raw_reading_id", rawReadingIds);
    const normalizedIds = (normalizedRows ?? []).map((row) => row.id);

    if (normalizedIds.length > 0) {
      await client
        .from("detected_events")
        .delete()
        .eq("rule_version", ruleVersion)
        .in("normalized_reading_id", normalizedIds);
    }

    await client
      .from("normalized_readings")
      .delete()
      .eq("normalization_version", normalizationVersion)
      .in("raw_reading_id", rawReadingIds);
  }

  await client
    .from("readiness_scores")
    .delete()
    .eq("score_version", scoreVersion);

  await client
    .from("system_logs")
    .delete()
    .eq("related_table_name", "ingestion_runs")
    .eq("related_record_id", ingestionRunId);

  await client.from("raw_readings").delete().eq("ingestion_run_id", ingestionRunId);
  await client.from("ingestion_runs").delete().eq("id", ingestionRunId);
}

async function main() {
  const { API_URL, SERVICE_ROLE_KEY } = getLocalSupabaseStatus();
  const client = createSupabaseServiceRoleClient({
    key: SERVICE_ROLE_KEY,
    url: API_URL,
  });
  const normalizationVersion = "validation-v1";
  const ruleVersion = "validation-rules-v1";
  const scoreVersion = "validation-score-v1";
  const simulationRun = generateSimulationRun({
    cadenceSeconds: 60,
    durationMinutes: 12,
    scenarios: [
      {
        crewCodes: ["CRW-001"],
        durationMinutes: 6,
        intensity: 1.15,
        kind: "acute_stress",
        startOffsetMinutes: 4,
      },
      {
        crewCodes: ["CRW-001"],
        durationMinutes: 3,
        intensity: 1,
        kind: "sensor_dropout",
        startOffsetMinutes: 8,
      },
    ],
    seed: 33,
    startAt: new Date("2026-03-28T20:00:00.000Z").toISOString(),
  });
  const ingestion = await ingestReadings(client, {
    readings: simulationRun.readings,
    runKind: "simulation",
    runMetadata: {
      validation: true,
    },
    sourceLabel: `validation-events-${Date.now()}`,
  });

  try {
    await normalizeIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion,
    });

    const detected = await detectEventsForIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion,
      ruleVersion,
    });

    if (detected.eventCount === 0) {
      throw new Error("Expected at least one detected event from the validation scenario.");
    }

    const scored = await calculateReadinessScoresForIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion,
      ruleVersion,
      scoreVersion,
    });

    if (scored.scoreCount === 0) {
      throw new Error("Expected readiness scores to be written.");
    }

    const { data: crewMember } = await client
      .from("crew_members")
      .select("id")
      .eq("crew_code", "CRW-001")
      .maybeSingle();

    if (!crewMember) {
      throw new Error("Could not resolve crew member CRW-001 for validation.");
    }

    const { data: targetScore, error: targetScoreError } = await client
      .from("readiness_scores")
      .select("composite_score, confidence_modifier, score_explanation")
      .eq("crew_member_id", crewMember.id)
      .eq("score_version", scoreVersion)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (targetScoreError) {
      throw new Error(`[readiness_scores] select failed: ${targetScoreError.message}`);
    }

    if (!targetScore) {
      throw new Error("Expected a readiness score for CRW-001.");
    }

    if (targetScore.composite_score >= 90) {
      throw new Error("Expected triggered simulation states to lower the readiness score.");
    }

    const repeatedDetection = await detectEventsForIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion,
      ruleVersion,
    });
    const repeatedScoring = await calculateReadinessScoresForIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion,
      ruleVersion,
      scoreVersion,
    });

    if (repeatedDetection.eventCount !== detected.eventCount) {
      throw new Error("Expected repeat event detection to stay deterministic.");
    }

    if (repeatedScoring.scoreCount !== scored.scoreCount) {
      throw new Error("Expected repeat readiness scoring to stay deterministic.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          ...detected,
          readiness_score_for_crw_001: targetScore.composite_score,
          confidence_modifier_for_crw_001: targetScore.confidence_modifier,
          score_count: scored.scoreCount,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup(
      client,
      ingestion.ingestionRunId,
      normalizationVersion,
      ruleVersion,
      scoreVersion,
    );
  }
}

void main();
