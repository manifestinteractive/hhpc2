import { describe, expect, it } from "vitest";
import {
  convertToCanonicalValue,
  normalizeStreamReadings,
} from "@/lib/processing/normalization";
import type { Tables } from "@/types/database.generated";

type RawReading = Tables<"raw_readings">;

function createRawReading(overrides: Partial<RawReading>): RawReading {
  return {
    captured_at: "2026-03-28T18:00:00.000Z",
    created_at: "2026-03-28T18:00:00.000Z",
    crew_member_id: 1,
    id: 1,
    ingestion_run_id: 1,
    raw_unit: "bpm",
    raw_value: 60,
    reading_status: "ok",
    received_at: "2026-03-28T18:00:00.000Z",
    sensor_stream_id: 10,
    signal_type: "heart_rate",
    source_identifier: "test-1",
    source_metadata: {},
    source_payload: {
      confidence: 0.96,
    },
    source_signal_type: "heart_rate",
    ...overrides,
  };
}

describe("convertToCanonicalValue", () => {
  it("converts Fahrenheit to Celsius", () => {
    expect(convertToCanonicalValue("temperature", "fahrenheit", 98.6)).toBeCloseTo(
      37,
      1,
    );
  });

  it("converts minutes to hours", () => {
    expect(convertToCanonicalValue("sleep_duration", "minutes", 90)).toBe(1.5);
  });
});

describe("normalizeStreamReadings", () => {
  it("smooths values across a rolling window", () => {
    const rows = [
      createRawReading({ id: 1, raw_value: 60, source_identifier: "a" }),
      createRawReading({
        captured_at: "2026-03-28T18:01:00.000Z",
        id: 2,
        raw_value: 66,
        source_identifier: "b",
      }),
      createRawReading({
        captured_at: "2026-03-28T18:02:00.000Z",
        id: 3,
        raw_value: 72,
        source_identifier: "c",
      }),
    ];

    const normalized = normalizeStreamReadings(
      rows,
      { resting_heart_rate_bpm: 58 },
      "test-v1",
    );

    expect(normalized).toHaveLength(3);
    expect(normalized[0]?.normalized_value).toBe(60);
    expect(normalized[1]?.normalized_value).toBe(63);
    expect(normalized[2]?.normalized_value).toBe(66);
  });

  it("carries forward or falls back for missing data with lower confidence", () => {
    const rows = [
      createRawReading({ id: 1, raw_value: 62, source_identifier: "seed" }),
      createRawReading({
        captured_at: "2026-03-28T18:01:00.000Z",
        id: 2,
        raw_unit: "bpm",
        raw_value: null,
        reading_status: "missing",
        source_identifier: "missing",
        source_payload: {
          confidence: 0,
        },
      }),
      createRawReading({
        captured_at: "2026-03-28T18:02:00.000Z",
        id: 3,
        raw_unit: "bpm",
        raw_value: null,
        reading_status: "dropout",
        source_identifier: "dropout",
        source_payload: {
          confidence: 0.2,
        },
      }),
    ];

    const normalized = normalizeStreamReadings(
      rows,
      { resting_heart_rate_bpm: 58 },
      "test-v1",
    );

    expect(normalized[1]?.normalized_value).toBe(62);
    expect(normalized[2]?.normalized_value).toBe(62);
    expect(normalized[1]?.confidence_score).toBeLessThan(0.7);
    expect(normalized[2]?.confidence_score).toBeLessThan(0.7);
    expect(normalized[1]?.processing_metadata).toMatchObject({
      imputation_strategy: "carry-forward",
      raw_status: "missing",
    });
    expect(normalized[2]?.processing_metadata).toMatchObject({
      imputation_strategy: "carry-forward",
      raw_status: "dropout",
    });
  });
});
