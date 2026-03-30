import { describe, expect, it } from "vitest";
import { generateSimulationRun } from "@/lib/simulation/engine";
import { getDefaultSimulationCrewProfiles } from "@/lib/simulation/profiles";
import type {
  SimulationReading,
  SimulationScenarioKind,
  SimulationScenarioWindow,
} from "@/lib/simulation/types";

function getReadingsForCrewAndSignal(
  crewCode: string,
  signalType: string,
  result: ReturnType<typeof generateSimulationRun>,
) {
  return result.readings.filter(
    (reading) =>
      reading.crewCode === crewCode && reading.signalType === signalType,
  );
}

function getScenarioWindow(
  result: ReturnType<typeof generateSimulationRun>,
  kind: SimulationScenarioKind,
) {
  const window = result.scenarioWindows.find((candidate) => candidate.kind === kind);

  expect(window).toBeDefined();

  return window as SimulationScenarioWindow;
}

function getWindowReadings(
  result: ReturnType<typeof generateSimulationRun>,
  crewCode: string,
  signalType: string,
  window: SimulationScenarioWindow,
) {
  const windowStart = Date.parse(window.startAt);
  const windowEnd = Date.parse(window.endAt);

  return getReadingsForCrewAndSignal(crewCode, signalType, result).filter(
    (reading) => {
      const capturedAt = Date.parse(reading.capturedAt);
      return capturedAt >= windowStart && capturedAt <= windowEnd;
    },
  );
}

function getTrailingWindowSlice(
  readings: SimulationReading[],
  fraction = 0.25,
) {
  const count = Math.max(1, Math.ceil(readings.length * fraction));
  return readings.slice(-count);
}

function averageReadingValue(readings: SimulationReading[]) {
  const values = readings
    .filter((reading) => reading.value !== null)
    .map((reading) => reading.value as number);

  expect(values.length).toBeGreaterThan(0);

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("generateSimulationRun", () => {
  const baseConfig = {
    cadenceSeconds: 300,
    crewProfiles: getDefaultSimulationCrewProfiles(3),
    durationMinutes: 240,
    seed: 42,
    startAt: "2026-03-28T08:00:00.000Z",
    timestampJitterSeconds: 10,
  };

  it("is deterministic for the same config and seed", () => {
    const first = generateSimulationRun(baseConfig);
    const second = generateSimulationRun(baseConfig);

    expect(second).toEqual(first);
  });

  it("uses distinct crew baselines", () => {
    const result = generateSimulationRun({
      ...baseConfig,
      noiseScale: 0,
      scenarios: [],
      timestampJitterSeconds: 0,
    });

    const mayaHeartRate = getReadingsForCrewAndSignal(
      "CRW-001",
      "heart_rate",
      result,
    )
      .filter((reading) => reading.value !== null)
      .map((reading) => reading.value as number);
    const aminaHeartRate = getReadingsForCrewAndSignal(
      "CRW-003",
      "heart_rate",
      result,
    )
      .filter((reading) => reading.value !== null)
      .map((reading) => reading.value as number);

    const mayaAverage =
      mayaHeartRate.reduce((sum, value) => sum + value, 0) / mayaHeartRate.length;
    const aminaAverage =
      aminaHeartRate.reduce((sum, value) => sum + value, 0) /
      aminaHeartRate.length;

    expect(aminaAverage).toBeGreaterThan(mayaAverage);
  });

  it("injects acute stress spikes into heart rate and activity", () => {
    const result = generateSimulationRun(baseConfig);
    const heartRate = getReadingsForCrewAndSignal("CRW-001", "heart_rate", result)
      .filter((reading) => reading.value !== null)
      .map((reading) => reading.value as number);
    const activity = getReadingsForCrewAndSignal(
      "CRW-001",
      "activity_level",
      result,
    )
      .filter((reading) => reading.value !== null)
      .map((reading) => reading.value as number);

    expect(Math.max(...heartRate) - Math.min(...heartRate)).toBeGreaterThan(18);
    expect(Math.max(...activity)).toBeGreaterThan(0.9);
  });

  it("produces dropout or missing readings during the dropout scenario", () => {
    const result = generateSimulationRun(baseConfig);
    const dropoutReadings = result.readings.filter(
      (reading) =>
        reading.status !== "ok" &&
        reading.annotations.some((annotation) => annotation === "sensor_dropout"),
    );

    expect(dropoutReadings.length).toBeGreaterThan(0);
  });

  it("produces irregular sampling when jitter is enabled", () => {
    const result = generateSimulationRun(baseConfig);
    const signalReadings = getReadingsForCrewAndSignal(
      "CRW-001",
      "heart_rate",
      result,
    );
    const intervals = signalReadings.slice(1).map((reading, index) => {
      const previous = Date.parse(signalReadings[index].capturedAt);
      const current = Date.parse(reading.capturedAt);
      return Math.round((current - previous) / 1000);
    });

    expect(new Set(intervals).size).toBeGreaterThan(1);
  });

  describe("demo scenario validation", () => {
    const crewCode = "CRW-001";
    const scenarioBaseConfig = {
      cadenceSeconds: 300,
      crewProfiles: getDefaultSimulationCrewProfiles(1),
      durationMinutes: 180,
      noiseScale: 0.15,
      seed: 77,
      startAt: "2026-03-28T08:00:00.000Z",
      timestampJitterSeconds: 0,
    };

    function generateBaselineRun() {
      return generateSimulationRun({
        ...scenarioBaseConfig,
        scenarios: [],
      });
    }

    function generateScenarioRun(
      kind: SimulationScenarioKind,
      overrides?: {
        durationMinutes?: number;
        signalTypes?: Array<
          "heart_rate" | "heart_rate_variability" | "temperature"
        >;
      },
    ) {
      return generateSimulationRun({
        ...scenarioBaseConfig,
        scenarios: [
          {
            crewCodes: [crewCode],
            durationMinutes: overrides?.durationMinutes ?? 90,
            kind,
            signalTypes: overrides?.signalTypes,
            startOffsetMinutes: 30,
          },
        ],
      });
    }

    it("demonstrates acute stress as elevated cardiovascular strain and activity", () => {
      const baselineRun = generateBaselineRun();
      const scenarioRun = generateScenarioRun("acute_stress", {
        durationMinutes: 60,
      });
      const window = getScenarioWindow(scenarioRun, "acute_stress");

      const baselineHeartRate = averageReadingValue(
        getWindowReadings(baselineRun, crewCode, "heart_rate", window),
      );
      const stressedHeartRate = averageReadingValue(
        getWindowReadings(scenarioRun, crewCode, "heart_rate", window),
      );
      const baselineHrv = averageReadingValue(
        getWindowReadings(
          baselineRun,
          crewCode,
          "heart_rate_variability",
          window,
        ),
      );
      const stressedHrv = averageReadingValue(
        getWindowReadings(
          scenarioRun,
          crewCode,
          "heart_rate_variability",
          window,
        ),
      );
      const baselineTemperature = averageReadingValue(
        getWindowReadings(baselineRun, crewCode, "temperature", window),
      );
      const stressedTemperature = averageReadingValue(
        getWindowReadings(scenarioRun, crewCode, "temperature", window),
      );

      expect(stressedHeartRate - baselineHeartRate).toBeGreaterThan(10);
      expect(stressedHrv).toBeLessThan(baselineHrv - 12);
      expect(stressedTemperature).toBeGreaterThan(baselineTemperature + 0.15);
    });

    it("demonstrates fatigue as worsening recovery and lower activity over time", () => {
      const baselineRun = generateBaselineRun();
      const scenarioRun = generateScenarioRun("fatigue_trend", {
        durationMinutes: 120,
      });
      const window = getScenarioWindow(scenarioRun, "fatigue_trend");

      const baselineSleepDuration = averageReadingValue(
        getTrailingWindowSlice(
          getWindowReadings(baselineRun, crewCode, "sleep_duration", window),
        ),
      );
      const fatiguedSleepDuration = averageReadingValue(
        getTrailingWindowSlice(
          getWindowReadings(scenarioRun, crewCode, "sleep_duration", window),
        ),
      );
      const baselineSleepQuality = averageReadingValue(
        getTrailingWindowSlice(
          getWindowReadings(baselineRun, crewCode, "sleep_quality", window),
        ),
      );
      const fatiguedSleepQuality = averageReadingValue(
        getTrailingWindowSlice(
          getWindowReadings(scenarioRun, crewCode, "sleep_quality", window),
        ),
      );
      const baselineActivity = averageReadingValue(
        getTrailingWindowSlice(
          getWindowReadings(baselineRun, crewCode, "activity_level", window),
        ),
      );
      const fatiguedActivity = averageReadingValue(
        getTrailingWindowSlice(
          getWindowReadings(scenarioRun, crewCode, "activity_level", window),
        ),
      );

      expect(fatiguedSleepDuration).toBeLessThan(baselineSleepDuration - 1);
      expect(fatiguedSleepQuality).toBeLessThan(baselineSleepQuality - 10);
      expect(fatiguedActivity).toBeLessThan(baselineActivity - 0.12);
    });

    it("demonstrates sensor failure as low-confidence dropout rather than physiology", () => {
      const baselineRun = generateBaselineRun();
      const scenarioRun = generateScenarioRun("sensor_dropout", {
        durationMinutes: 75,
        signalTypes: ["heart_rate", "heart_rate_variability", "temperature"],
      });
      const window = getScenarioWindow(scenarioRun, "sensor_dropout");
      const scenarioHeartRate = getWindowReadings(
        scenarioRun,
        crewCode,
        "heart_rate",
        window,
      );
      const baselineHeartRate = getWindowReadings(
        baselineRun,
        crewCode,
        "heart_rate",
        window,
      );

      const abnormalReadings = scenarioHeartRate.filter(
        (reading) => reading.status !== "ok",
      );
      const baselineConfidence = averageReadingValue(
        baselineHeartRate.map((reading) => ({
          ...reading,
          value: reading.confidence,
        })),
      );
      const scenarioConfidence = averageReadingValue(
        scenarioHeartRate.map((reading) => ({
          ...reading,
          value: reading.confidence,
        })),
      );

      expect(abnormalReadings.length).toBeGreaterThan(0);
      expect(
        abnormalReadings.every((reading) =>
          reading.annotations.includes("sensor_dropout"),
        ),
      ).toBe(true);
      expect(scenarioConfidence).toBeLessThan(baselineConfidence - 0.35);
    });

    it("demonstrates recovery as improving cardiovascular and sleep markers", () => {
      const baselineRun = generateBaselineRun();
      const scenarioRun = generateScenarioRun("recovery_pattern", {
        durationMinutes: 100,
      });
      const window = getScenarioWindow(scenarioRun, "recovery_pattern");

      const baselineHeartRate = averageReadingValue(
        getWindowReadings(baselineRun, crewCode, "heart_rate", window),
      );
      const recoveredHeartRate = averageReadingValue(
        getWindowReadings(scenarioRun, crewCode, "heart_rate", window),
      );
      const baselineHrv = averageReadingValue(
        getWindowReadings(
          baselineRun,
          crewCode,
          "heart_rate_variability",
          window,
        ),
      );
      const recoveredHrv = averageReadingValue(
        getWindowReadings(
          scenarioRun,
          crewCode,
          "heart_rate_variability",
          window,
        ),
      );
      const baselineSleepQuality = averageReadingValue(
        getWindowReadings(baselineRun, crewCode, "sleep_quality", window),
      );
      const recoveredSleepQuality = averageReadingValue(
        getWindowReadings(scenarioRun, crewCode, "sleep_quality", window),
      );

      expect(recoveredHeartRate).toBeLessThan(baselineHeartRate - 5);
      expect(recoveredHrv).toBeGreaterThan(baselineHrv + 10);
      expect(recoveredSleepQuality).toBeGreaterThan(
        baselineSleepQuality + 8,
      );
    });
  });
});
