import { getServerEnv } from "@/lib/env/server";
import { getDefaultSimulationCrewProfiles } from "@/lib/simulation/profiles";
import { createSeededRandom } from "@/lib/simulation/random";
import {
  buildDefaultScenarioConfigs,
  buildScenarioWindows,
  getActiveScenarioWindows,
  getScenarioEffect,
  summarizeScenarioKinds,
} from "@/lib/simulation/scenarios";
import type {
  SimulationCrewProfile,
  SimulationReading,
  SimulationRunConfig,
  SimulationRunResult,
  SimulationSignalType,
} from "@/lib/simulation/types";

const signalDefinitions: Record<
  SimulationSignalType,
  {
    clamp: [number, number];
    unit: string;
  }
> = {
  activity_level: { clamp: [0, 1], unit: "normalized" },
  heart_rate: { clamp: [40, 190], unit: "bpm" },
  heart_rate_variability: { clamp: [12, 140], unit: "ms" },
  sleep_duration: { clamp: [0, 12], unit: "hours" },
  sleep_quality: { clamp: [0, 100], unit: "score" },
  temperature: { clamp: [35.5, 38.8], unit: "celsius" },
};

const signalTypes = Object.keys(signalDefinitions) as SimulationSignalType[];

type InternalConfig = Omit<
  SimulationRunConfig,
  "missingRate" | "noiseScale" | "timestampJitterSeconds"
> & {
  missingRate: number;
  noiseScale: number;
  timestampJitterSeconds: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(signalType: SimulationSignalType, value: number) {
  if (signalType === "heart_rate" || signalType === "heart_rate_variability") {
    return Math.round(value * 10) / 10;
  }

  if (signalType === "temperature") {
    return Math.round(value * 100) / 100;
  }

  return Math.round(value * 1000) / 1000;
}

function getCircadianSignalOffset(
  signalType: SimulationSignalType,
  profile: SimulationCrewProfile,
  timestamp: Date,
) {
  const hour =
    timestamp.getUTCHours() + timestamp.getUTCMinutes() / 60 + profile.stressSensitivity;
  const circadian = Math.sin(((hour - 4) / 24) * Math.PI * 2);
  const activityWave = Math.max(0, Math.sin(((hour - 6) / 24) * Math.PI * 2));

  switch (signalType) {
    case "heart_rate":
      return circadian * 2.2 + activityWave * 8;
    case "heart_rate_variability":
      return -circadian * 3.5 - activityWave * 6;
    case "activity_level":
      return activityWave * 0.35 - 0.08;
    case "temperature":
      return circadian * 0.18;
    case "sleep_duration":
      return -activityWave * 0.15;
    case "sleep_quality":
      return -activityWave * 3.5;
  }
}

function getBaseSignalValue(
  signalType: SimulationSignalType,
  profile: SimulationCrewProfile,
  timestamp: Date,
) {
  const circadianOffset = getCircadianSignalOffset(signalType, profile, timestamp);

  switch (signalType) {
    case "heart_rate":
      return profile.restingHeartRateBpm + circadianOffset;
    case "heart_rate_variability":
      return profile.heartRateVariabilityMs + circadianOffset;
    case "activity_level":
      return profile.activityTarget + circadianOffset;
    case "temperature":
      return profile.baselineBodyTemperatureC + circadianOffset;
    case "sleep_duration":
      return profile.sleepTargetHours + circadianOffset;
    case "sleep_quality":
      return 78 + (profile.sleepTargetHours - 7.2) * 6 + circadianOffset;
  }
}

function resolveConfig(config: Partial<SimulationRunConfig> = {}): InternalConfig {
  const env = getServerEnv();
  const crewProfiles =
    config.crewProfiles ?? getDefaultSimulationCrewProfiles(env.SIM_DEFAULT_CREW_COUNT);
  const durationMinutes = config.durationMinutes ?? 360;
  const scenarios =
    config.scenarios ?? buildDefaultScenarioConfigs(durationMinutes);

  return {
    cadenceSeconds: config.cadenceSeconds ?? env.SIM_DEFAULT_CADENCE_SECONDS,
    crewProfiles,
    durationMinutes,
    missingRate: config.missingRate ?? 0.015,
    noiseScale: config.noiseScale ?? 1,
    scenarios,
    seed: config.seed ?? env.SIM_DEFAULT_SEED,
    startAt: config.startAt ?? new Date().toISOString(),
    timestampJitterSeconds: config.timestampJitterSeconds ?? 12,
  };
}

export function generateSimulationRun(
  config: Partial<SimulationRunConfig> = {},
): SimulationRunResult {
  const resolved = resolveConfig(config);
  const random = createSeededRandom(resolved.seed);
  const scenarioWindows = buildScenarioWindows(resolved);
  const readings: SimulationReading[] = [];
  const totalSteps = Math.floor(
    (resolved.durationMinutes * 60) / resolved.cadenceSeconds,
  );
  const runStart = Date.parse(resolved.startAt);
  const previousValues = new Map<string, number | null>();

  for (const profile of resolved.crewProfiles) {
    for (let step = 0; step <= totalSteps; step += 1) {
      const baseTimestamp = new Date(
        runStart + step * resolved.cadenceSeconds * 1000,
      );
      const jitterSeconds = random.float(
        -resolved.timestampJitterSeconds,
        resolved.timestampJitterSeconds,
      );
      const capturedAt = new Date(
        baseTimestamp.getTime() + jitterSeconds * 1000,
      );

      for (const signalType of signalTypes) {
        const activeWindows = getActiveScenarioWindows(
          scenarioWindows,
          profile.crewCode,
          signalType,
          capturedAt,
        );
        const key = `${profile.crewCode}:${signalType}`;
        const annotations: string[] = [];
        let missingProbability = resolved.missingRate ?? 0;
        let dropoutProbability = 0;
        let flatlineProbability = 0;
        let confidencePenalty = 0;
        let value = getBaseSignalValue(signalType, profile, capturedAt);

        for (const window of activeWindows) {
          const effect = getScenarioEffect(window, signalType, profile, capturedAt);
          value = (value + (effect.valueOffset ?? 0)) * (effect.valueScale ?? 1);
          missingProbability += effect.missingProbability ?? 0;
          dropoutProbability += effect.dropoutProbability ?? 0;
          flatlineProbability += effect.flatlineProbability ?? 0;
          confidencePenalty += effect.confidencePenalty ?? 0;
        }

        const noiseAmplitude =
          signalType === "heart_rate"
            ? 1.8
            : signalType === "heart_rate_variability"
              ? 3.4
              : signalType === "activity_level"
                ? 0.05
                : signalType === "temperature"
                  ? 0.04
                  : signalType === "sleep_duration"
                    ? 0.08
                    : 1.8;
        value += random.float(-noiseAmplitude, noiseAmplitude) * resolved.noiseScale;

        const [min, max] = signalDefinitions[signalType].clamp;
        let status: SimulationReading["status"] = "ok";
        let confidence = clamp(
          0.96 - confidencePenalty - random.float(0, 0.08),
          0,
          1,
        );
        let readingValue: number | null = roundValue(
          signalType,
          clamp(value, min, max),
        );

        if (random.boolean(Math.min(missingProbability, 0.45))) {
          status = "missing";
          confidence = 0;
          readingValue = null;
          annotations.push("missing-data");
        } else if (random.boolean(Math.min(dropoutProbability, 0.9))) {
          status = "dropout";
          confidence = clamp(0.18 - confidencePenalty, 0, 0.25);

          if (random.boolean(Math.min(flatlineProbability, 0.75))) {
            readingValue = previousValues.get(key) ?? null;
            annotations.push("flatline");
          } else {
            readingValue = null;
            annotations.push("null-dropout");
          }
        }

        if (Math.abs(jitterSeconds) >= 1) {
          annotations.push("irregular-sampling");
        }

        previousValues.set(key, readingValue);

        readings.push({
          annotations: [
            ...annotations,
            ...summarizeScenarioKinds(activeWindows),
          ],
          capturedAt: capturedAt.toISOString(),
          confidence,
          crewCode: profile.crewCode,
          signalType,
          sourceKey: `${profile.crewCode}-${signalType}-primary`,
          status,
          unit: signalDefinitions[signalType].unit,
          value: readingValue,
        });
      }
    }
  }

  readings.sort((left, right) => {
    if (left.capturedAt === right.capturedAt) {
      if (left.crewCode === right.crewCode) {
        return left.signalType.localeCompare(right.signalType);
      }

      return left.crewCode.localeCompare(right.crewCode);
    }

    return left.capturedAt.localeCompare(right.capturedAt);
  });

  return {
    config: resolved,
    crewProfiles: resolved.crewProfiles,
    readings,
    scenarioWindows,
  };
}
