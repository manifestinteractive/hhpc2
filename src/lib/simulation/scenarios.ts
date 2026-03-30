import type {
  SimulationCrewProfile,
  SimulationRunConfig,
  SimulationScenarioConfig,
  SimulationScenarioKind,
  SimulationScenarioWindow,
  SimulationSignalType,
} from "@/lib/simulation/types";

type ScenarioEffect = {
  confidencePenalty?: number;
  dropoutProbability?: number;
  flatlineProbability?: number;
  missingProbability?: number;
  valueOffset?: number;
  valueScale?: number;
};

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getAcuteStressLoad(progress: number) {
  const bell = Math.sin(Math.PI * progress);
  const pulse = 0.9 + 0.1 * Math.sin(progress * Math.PI * 6);
  return clampUnit(bell * pulse);
}

function getFatigueLoad(progress: number) {
  const build = 1 - Math.exp(-4.6 * progress);
  const wave = 0.94 + 0.08 * Math.sin(progress * Math.PI * 2.5 - Math.PI / 4);
  return clampUnit(build * wave);
}

function getRecoveryLoad(progress: number) {
  const rebound = 1 - Math.exp(-4.2 * progress);
  const settle = 0.96 + 0.04 * Math.sin(progress * Math.PI * 2);
  return clampUnit(rebound * settle);
}

function createWindow(
  config: SimulationScenarioConfig,
  startAt: Date,
): SimulationScenarioWindow {
  const startOffsetMinutes = config.startOffsetMinutes ?? 0;
  const durationMinutes = config.durationMinutes ?? 0;
  const windowStart = new Date(startAt.getTime() + startOffsetMinutes * 60_000);
  const windowEnd = new Date(windowStart.getTime() + durationMinutes * 60_000);

  return {
    crewCodes: config.crewCodes,
    durationMinutes,
    endAt: windowEnd.toISOString(),
    intensity: config.intensity ?? 1,
    kind: config.kind,
    signalTypes: config.signalTypes,
    startAt: windowStart.toISOString(),
    startOffsetMinutes,
  };
}

export function buildDefaultScenarioConfigs(
  durationMinutes: number,
): SimulationScenarioConfig[] {
  return [
    {
      durationMinutes,
      intensity: 0.75,
      kind: "fatigue_trend",
      startOffsetMinutes: 0,
    },
    {
      durationMinutes: Math.max(20, Math.round(durationMinutes * 0.18)),
      intensity: 1,
      kind: "acute_stress",
      signalTypes: ["heart_rate", "heart_rate_variability", "activity_level"],
      startOffsetMinutes: Math.round(durationMinutes * 0.38),
    },
    {
      durationMinutes: Math.max(15, Math.round(durationMinutes * 0.15)),
      intensity: 1,
      kind: "sensor_dropout",
      signalTypes: ["heart_rate", "heart_rate_variability", "temperature"],
      startOffsetMinutes: Math.round(durationMinutes * 0.58),
    },
    {
      durationMinutes: Math.max(30, Math.round(durationMinutes * 0.22)),
      intensity: 0.8,
      kind: "recovery_pattern",
      startOffsetMinutes: Math.round(durationMinutes * 0.72),
    },
  ];
}

export function buildScenarioWindows(
  config: Pick<SimulationRunConfig, "durationMinutes" | "scenarios" | "startAt">,
) {
  const startAt = new Date(config.startAt);

  return config.scenarios.map((scenario) => createWindow(scenario, startAt));
}

function matchesWindow(
  window: SimulationScenarioWindow,
  crewCode: string,
  signalType: SimulationSignalType,
  capturedAt: Date,
) {
  const windowStart = Date.parse(window.startAt);
  const windowEnd = Date.parse(window.endAt);

  if (capturedAt.getTime() < windowStart || capturedAt.getTime() > windowEnd) {
    return false;
  }

  if (window.crewCodes && !window.crewCodes.includes(crewCode)) {
    return false;
  }

  if (window.signalTypes && !window.signalTypes.includes(signalType)) {
    return false;
  }

  return true;
}

export function getActiveScenarioWindows(
  windows: SimulationScenarioWindow[],
  crewCode: string,
  signalType: SimulationSignalType,
  capturedAt: Date,
) {
  return windows.filter((window) =>
    matchesWindow(window, crewCode, signalType, capturedAt),
  );
}

function getWindowProgress(window: SimulationScenarioWindow, capturedAt: Date) {
  const start = Date.parse(window.startAt);
  const end = Date.parse(window.endAt);
  const duration = Math.max(end - start, 1);
  return Math.max(0, Math.min(1, (capturedAt.getTime() - start) / duration));
}

export function getScenarioEffect(
  window: SimulationScenarioWindow,
  signalType: SimulationSignalType,
  profile: SimulationCrewProfile,
  capturedAt: Date,
): ScenarioEffect {
  const progress = getWindowProgress(window, capturedAt);
  const intensity = window.intensity;

  switch (window.kind) {
    case "fatigue_trend": {
      const fatigueLoad = getFatigueLoad(progress) * intensity;

      if (signalType === "heart_rate") {
        return { valueOffset: 18 * fatigueLoad };
      }

      if (signalType === "heart_rate_variability") {
        return { valueOffset: -34 * fatigueLoad };
      }

      if (signalType === "activity_level") {
        return { valueOffset: -0.34 * fatigueLoad };
      }

      if (signalType === "sleep_duration") {
        return { valueOffset: -2.6 * fatigueLoad };
      }

      if (signalType === "sleep_quality") {
        return { valueOffset: -26 * fatigueLoad };
      }

      return {
        confidencePenalty: 0.03 * fatigueLoad,
        valueOffset: 0.34 * fatigueLoad,
      };
    }

    case "acute_stress": {
      const stressLoad = getAcuteStressLoad(progress) * intensity;

      if (signalType === "heart_rate") {
        return {
          valueOffset:
            (24 + profile.restingHeartRateBpm * 0.22) * stressLoad,
        };
      }

      if (signalType === "heart_rate_variability") {
        return {
          valueOffset:
            -34 * stressLoad * Math.max(profile.stressSensitivity, 0.85),
        };
      }

      if (signalType === "activity_level") {
        return { valueOffset: 0.48 * stressLoad };
      }

      if (signalType === "temperature") {
        return { valueOffset: 0.48 * stressLoad };
      }

      if (signalType === "sleep_quality") {
        return { valueOffset: -8 * stressLoad };
      }

      if (signalType === "sleep_duration") {
        return { valueOffset: -0.4 * stressLoad };
      }

      return { confidencePenalty: 0.08 * stressLoad };
    }

    case "sensor_dropout":
      return {
        confidencePenalty: 0.92,
        dropoutProbability: 0.45 * intensity,
        flatlineProbability: 0.38 * intensity,
        missingProbability: 0.32 * intensity,
      };

    case "recovery_pattern": {
      const recoveryLoad = getRecoveryLoad(progress) * intensity;

      if (signalType === "heart_rate") {
        return { valueOffset: -12 * recoveryLoad };
      }

      if (signalType === "heart_rate_variability") {
        return { valueOffset: 26 * recoveryLoad };
      }

      if (signalType === "activity_level") {
        return { valueOffset: 0.16 * recoveryLoad };
      }

      if (signalType === "sleep_duration") {
        return { valueOffset: 1.8 * recoveryLoad };
      }

      if (signalType === "sleep_quality") {
        return { valueOffset: 18 * recoveryLoad };
      }

      return { valueOffset: -0.22 * recoveryLoad };
    }
  }
}

export function summarizeScenarioKinds(
  windows: SimulationScenarioWindow[],
): SimulationScenarioKind[] {
  return windows.map((window) => window.kind);
}
