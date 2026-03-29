import { describe, expect, it } from "vitest";
import { generateSimulationRun } from "@/lib/simulation/engine";
import { getDefaultSimulationCrewProfiles } from "@/lib/simulation/profiles";

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
});
