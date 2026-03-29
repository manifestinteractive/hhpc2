import { describe, expect, it } from "vitest";
import { detectEventsForReading } from "@/lib/processing/events";
import type { Tables } from "@/types/database.generated";

type NormalizedReading = Tables<"normalized_readings">;

function createNormalizedReading(
  overrides: Partial<NormalizedReading>,
): NormalizedReading {
  return {
    captured_at: "2026-03-28T19:00:00.000Z",
    confidence_score: 0.94,
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
    source_reading_count: 3,
    source_window_ended_at: "2026-03-28T19:00:00.000Z",
    source_window_started_at: "2026-03-28T18:58:00.000Z",
    ...overrides,
  };
}

describe("detectEventsForReading", () => {
  it("detects elevated heart rate against baseline", () => {
    const events = detectEventsForReading(
      createNormalizedReading({
        normalized_value: 78,
        signal_type: "heart_rate",
      }),
      { resting_heart_rate_bpm: 60 },
      "rules-v1",
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "elevated_heart_rate",
      rule_id: "heart-rate-elevated",
      rule_version: "rules-v1",
      severity: "medium",
    });
  });

  it("detects sensor reliability issues from imputed data", () => {
    const events = detectEventsForReading(
      createNormalizedReading({
        confidence_score: 0.52,
        processing_metadata: {
          consecutive_missing_count: 2,
          quality_flags: ["missing", "imputed"],
          raw_status: "missing",
        },
      }),
      { resting_heart_rate_bpm: 60 },
      "rules-v1",
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "sensor_reliability_issue",
      severity: "medium",
    });
  });

  it("detects poor sleep quality separately from sleep deficit", () => {
    const events = detectEventsForReading(
      createNormalizedReading({
        normalized_unit: "score",
        normalized_value: 58,
        signal_type: "sleep_quality",
      }),
      { sleep_quality_target: 84 },
      "rules-v1",
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.event_type).toBe("poor_sleep_quality");
  });
});
