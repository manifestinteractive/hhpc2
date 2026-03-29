import { describe, expect, it } from "vitest";
import { computeCrewReadinessScore } from "@/lib/processing/scoring";
import type { Tables } from "@/types/database.generated";

type DetectedEvent = Tables<"detected_events">;
type NormalizedReading = Tables<"normalized_readings">;

function createNormalizedReading(
  overrides: Partial<NormalizedReading>,
): NormalizedReading {
  return {
    captured_at: "2026-03-28T19:00:00.000Z",
    confidence_score: 0.96,
    created_at: "2026-03-28T19:00:00.000Z",
    crew_member_id: 1,
    id: 1,
    normalization_version: "test-v1",
    normalized_unit: "bpm",
    normalized_value: 60,
    processing_metadata: {
      quality_flags: [],
      raw_status: "ok",
    },
    raw_reading_id: 10,
    sensor_stream_id: 100,
    signal_type: "heart_rate",
    source_reading_count: 1,
    source_window_ended_at: "2026-03-28T19:00:00.000Z",
    source_window_started_at: "2026-03-28T19:00:00.000Z",
    ...overrides,
  };
}

function createDetectedEvent(overrides: Partial<DetectedEvent>): DetectedEvent {
  return {
    confidence_score: 0.9,
    created_at: "2026-03-28T19:00:00.000Z",
    crew_member_id: 1,
    ended_at: "2026-03-28T19:00:00.000Z",
    event_type: "elevated_heart_rate",
    evidence: {},
    explanation: "Test event",
    id: 1,
    normalized_reading_id: 1,
    primary_signal_type: "heart_rate",
    rule_id: "heart-rate-elevated",
    rule_version: "rules-v1",
    sensor_stream_id: 100,
    severity: "medium",
    started_at: "2026-03-28T18:59:00.000Z",
    ...overrides,
  };
}

describe("computeCrewReadinessScore", () => {
  it("reduces readiness when signals deviate from baseline", () => {
    const result = computeCrewReadinessScore(
      [
        createNormalizedReading({
          id: 1,
          normalized_value: 86,
          signal_type: "heart_rate",
        }),
        createNormalizedReading({
          id: 2,
          normalized_unit: "ms",
          normalized_value: 41,
          signal_type: "heart_rate_variability",
        }),
        createNormalizedReading({
          id: 3,
          normalized_unit: "hours",
          normalized_value: 5.8,
          signal_type: "sleep_duration",
        }),
        createNormalizedReading({
          id: 4,
          normalized_unit: "score",
          normalized_value: 62,
          signal_type: "sleep_quality",
        }),
      ],
      [createDetectedEvent({ severity: "high" })],
      {
        heart_rate_variability_ms: 70,
        resting_heart_rate_bpm: 58,
        sleep_quality_target: 84,
        sleep_target_hours: 8,
      },
    );

    expect(result.score).toBeLessThan(70);
    expect(result.confidenceModifier).toBeGreaterThan(0.8);
    expect(result.scoreExplanation.event_penalty).toBe(14);
  });

  it("keeps high readiness for baseline-aligned signals", () => {
    const result = computeCrewReadinessScore(
      [
        createNormalizedReading({
          id: 1,
          normalized_value: 58,
          signal_type: "heart_rate",
        }),
        createNormalizedReading({
          id: 2,
          normalized_unit: "ms",
          normalized_value: 70,
          signal_type: "heart_rate_variability",
        }),
        createNormalizedReading({
          id: 3,
          normalized_unit: "normalized",
          normalized_value: 0.66,
          signal_type: "activity_level",
        }),
        createNormalizedReading({
          id: 4,
          normalized_unit: "hours",
          normalized_value: 8,
          signal_type: "sleep_duration",
        }),
        createNormalizedReading({
          id: 5,
          normalized_unit: "score",
          normalized_value: 84,
          signal_type: "sleep_quality",
        }),
        createNormalizedReading({
          id: 6,
          normalized_unit: "celsius",
          normalized_value: 36.7,
          signal_type: "temperature",
        }),
      ],
      [],
      {
        baseline_body_temperature_c: 36.7,
        daily_activity_target: 0.66,
        heart_rate_variability_ms: 70,
        resting_heart_rate_bpm: 58,
        sleep_quality_target: 84,
        sleep_target_hours: 8,
      },
    );

    expect(result.score).toBeGreaterThan(95);
    expect(result.windowStartedAt).toBe("2026-03-28T19:00:00.000Z");
  });
});
