import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/db";
import {
  calculateReadinessScoresForIngestionRun,
  DEFAULT_EVENT_RULE_VERSION,
  DEFAULT_NORMALIZATION_VERSION,
  DEFAULT_SCORE_VERSION,
  detectEventsForIngestionRun,
  ingestSimulationRequest,
} from "@/lib/processing";
import type { SimulationControlResponse } from "@/types/api";
import {
  simulationIngestionRequestSchema,
} from "@/lib/processing/ingestion";
import { normalizeIngestionRun } from "@/lib/processing/normalization";

const simulationControlRequestSchema = simulationIngestionRequestSchema.extend({
  normalizeVersion: z.string().trim().min(1).default(DEFAULT_NORMALIZATION_VERSION),
  ruleVersion: z.string().trim().min(1).default(DEFAULT_EVENT_RULE_VERSION),
  scoreVersion: z.string().trim().min(1).default(DEFAULT_SCORE_VERSION),
  runEventDetection: z.boolean().default(true),
  runNormalization: z.boolean().default(true),
  runReadinessScoring: z.boolean().default(true),
});

export type SimulationControlRequest = z.infer<typeof simulationControlRequestSchema>;

export function parseSimulationControlRequest(input: unknown) {
  return simulationControlRequestSchema.safeParse(input);
}

export async function runSimulationControl(
  request: SimulationControlRequest,
): Promise<SimulationControlResponse> {
  const client = createSupabaseServiceRoleClient();
  const ingestion = await ingestSimulationRequest({
    cadenceSeconds: request.cadenceSeconds,
    crewCodes: request.crewCodes,
    crewCount: request.crewCount,
    durationMinutes: request.durationMinutes,
    missingRate: request.missingRate,
    noiseScale: request.noiseScale,
    scenarios: request.scenarios,
    seed: request.seed,
    sourceLabel: request.sourceLabel,
    startAt: request.startAt,
    timestampJitterSeconds: request.timestampJitterSeconds,
  });

  let eventDetection: SimulationControlResponse["eventDetection"] = null;
  let readinessScoring: SimulationControlResponse["readinessScoring"] = null;

  if (request.runNormalization) {
    await normalizeIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion: request.normalizeVersion,
    });
  }

  if (request.runNormalization && request.runEventDetection) {
    const detected = await detectEventsForIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion: request.normalizeVersion,
      ruleVersion: request.ruleVersion,
    });

    eventDetection = {
      eventCount: detected.eventCount,
      eventTypes: detected.eventTypes,
      normalizationVersion: detected.normalizationVersion,
      ruleVersion: detected.ruleVersion,
    };
  }

  if (
    request.runNormalization &&
    request.runEventDetection &&
    request.runReadinessScoring
  ) {
    const scored = await calculateReadinessScoresForIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion: request.normalizeVersion,
      ruleVersion: request.ruleVersion,
      scoreVersion: request.scoreVersion,
    });

    readinessScoring = {
      crewMemberCount: scored.crewMemberCount,
      normalizationVersion: scored.normalizationVersion,
      ruleVersion: scored.ruleVersion,
      scoreCount: scored.scoreCount,
      scoreVersion: scored.scoreVersion,
    };
  }

  return {
    eventDetection,
    generated: ingestion.generated,
    ingestion: {
      acceptedRecordCount: ingestion.acceptedRecordCount,
      ingestionRunId: ingestion.ingestionRunId,
      inputRecordCount: ingestion.inputRecordCount,
      rejectedRecordCount: ingestion.rejectedRecordCount,
      rejectionSamples: ingestion.rejectionSamples,
      status: ingestion.status,
    },
    readinessScoring,
  };
}
