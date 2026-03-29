export type SimulationSignalType =
  | "heart_rate"
  | "heart_rate_variability"
  | "activity_level"
  | "temperature"
  | "sleep_duration"
  | "sleep_quality";

export type SimulationScenarioKind =
  | "fatigue_trend"
  | "acute_stress"
  | "sensor_dropout"
  | "recovery_pattern";

export type SimulationReadingStatus = "ok" | "missing" | "dropout";

export type SimulationCrewProfile = {
  activityTarget: number;
  baselineBodyTemperatureC: number;
  callSign: string;
  crewCode: string;
  displayName: string;
  heartRateVariabilityMs: number;
  restingHeartRateBpm: number;
  sleepTargetHours: number;
  stressSensitivity: number;
};

export type SimulationScenarioConfig = {
  crewCodes?: string[];
  durationMinutes?: number;
  intensity?: number;
  kind: SimulationScenarioKind;
  signalTypes?: SimulationSignalType[];
  startOffsetMinutes?: number;
};

export type SimulationScenarioWindow = Required<
  Pick<
    SimulationScenarioConfig,
    "durationMinutes" | "intensity" | "kind" | "startOffsetMinutes"
  >
> &
  Pick<SimulationScenarioConfig, "crewCodes" | "signalTypes"> & {
    endAt: string;
    startAt: string;
  };

export type SimulationRunConfig = {
  cadenceSeconds: number;
  crewProfiles: SimulationCrewProfile[];
  durationMinutes: number;
  missingRate?: number;
  noiseScale?: number;
  scenarios: SimulationScenarioConfig[];
  seed: number;
  startAt: string;
  timestampJitterSeconds?: number;
};

export type SimulationReading = {
  annotations: string[];
  capturedAt: string;
  confidence: number;
  crewCode: string;
  signalType: SimulationSignalType;
  sourceKey: string;
  status: SimulationReadingStatus;
  unit: string;
  value: number | null;
};

export type SimulationRunResult = {
  config: SimulationRunConfig;
  crewProfiles: SimulationCrewProfile[];
  readings: SimulationReading[];
  scenarioWindows: SimulationScenarioWindow[];
};
