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
    case "fatigue_trend":
      if (signalType === "heart_rate") {
        return { valueOffset: 8 * intensity * progress };
      }

      if (signalType === "heart_rate_variability") {
        return { valueOffset: -18 * intensity * progress };
      }

      if (signalType === "activity_level") {
        return { valueOffset: -0.18 * intensity * progress };
      }

      if (signalType === "sleep_duration") {
        return { valueOffset: -1.25 * intensity * progress };
      }

      if (signalType === "sleep_quality") {
        return { valueOffset: -14 * intensity * progress };
      }

      return { valueOffset: 0.08 * intensity * progress };

    case "acute_stress": {
      const bell = Math.sin(Math.PI * progress);

      if (signalType === "heart_rate") {
        return { valueOffset: (14 + profile.restingHeartRateBpm * 0.15) * bell };
      }

      if (signalType === "heart_rate_variability") {
        return { valueOffset: -20 * intensity * bell * profile.stressSensitivity };
      }

      if (signalType === "activity_level") {
        return { valueOffset: 0.32 * intensity * bell };
      }

      return { confidencePenalty: 0.04 };
    }

    case "sensor_dropout":
      return {
        confidencePenalty: 0.85,
        dropoutProbability: 0.28 * intensity,
        flatlineProbability: 0.24 * intensity,
        missingProbability: 0.18 * intensity,
      };

    case "recovery_pattern":
      if (signalType === "heart_rate") {
        return { valueOffset: -6 * intensity * progress };
      }

      if (signalType === "heart_rate_variability") {
        return { valueOffset: 16 * intensity * progress };
      }

      if (signalType === "activity_level") {
        return { valueOffset: 0.12 * intensity * progress };
      }

      if (signalType === "sleep_duration") {
        return { valueOffset: 0.95 * intensity * progress };
      }

      if (signalType === "sleep_quality") {
        return { valueOffset: 12 * intensity * progress };
      }

      return { valueOffset: -0.05 * intensity * progress };
  }
}

export function summarizeScenarioKinds(
  windows: SimulationScenarioWindow[],
): SimulationScenarioKind[] {
  return windows.map((window) => window.kind);
}
