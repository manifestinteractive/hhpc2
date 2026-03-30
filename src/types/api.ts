import type { Json, TableEnum } from "@/lib/db";

export type CrewOverviewItem = {
  crewCode: string;
  displayName: string;
  callSign: string | null;
  roleTitle: string;
  latestReadiness: {
    calculatedAt: string;
    compositeScore: number;
    confidenceModifier: number;
    scoreVersion: string;
  } | null;
  recentEventCounts: {
    high: number;
    medium: number;
    low: number;
  };
  latestEvent: {
    eventType: string;
    severity: TableEnum<"event_severity">;
    startedAt: string;
  } | null;
};

export type CrewListResponse = {
  crews: CrewOverviewItem[];
};

export type CrewSignalSnapshot = {
  capturedAt: string;
  confidenceScore: number;
  normalizedUnit: string;
  normalizedValue: number;
  signalType: TableEnum<"signal_type">;
};

export type CrewTelemetrySeries = {
  label: string;
  normalizedUnit: string;
  points: LiveTelemetryPoint[];
  signalType: TableEnum<"signal_type">;
};

export type CrewTelemetryBundle = {
  crewCode: string;
  crewDisplayName: string;
  series: CrewTelemetrySeries[];
};

export type CrewDetailResponse = {
  crew: {
    crewCode: string;
    displayName: string;
    givenName: string;
    familyName: string;
    callSign: string | null;
    roleTitle: string;
    baselineTimezone: string;
    baselineProfile: Json;
    profileMetadata: Json;
  };
  latestReadiness: {
    calculatedAt: string;
    compositeScore: number;
    confidenceModifier: number;
    scoreComponents: Json;
    scoreExplanation: Json;
    scoreVersion: string;
  } | null;
  recentEvents: EventListItem[];
  readinessHistory: ReadinessScoreItem[];
  signalSnapshots: CrewSignalSnapshot[];
  telemetryHistory: CrewTelemetryBundle | null;
};

export type EventListItem = {
  id: number;
  crewCode: string | null;
  crewDisplayName: string | null;
  eventType: string;
  severity: TableEnum<"event_severity">;
  confidenceScore: number;
  startedAt: string;
  endedAt: string | null;
  primarySignalType: TableEnum<"signal_type"> | null;
  ruleId: string;
  ruleVersion: string;
  explanation: string;
  evidence: Json;
};

export type EventListResponse = {
  events: EventListItem[];
};

export type ReadinessScoreItem = {
  id: number;
  crewCode: string | null;
  crewDisplayName: string | null;
  calculatedAt: string;
  windowStartedAt: string;
  windowEndedAt: string;
  compositeScore: number;
  confidenceModifier: number;
  scoreComponents: Json;
  scoreExplanation: Json;
  scoreVersion: string;
};

export type ReadinessScoreListResponse = {
  scores: ReadinessScoreItem[];
};

export type FleetTrendPoint = {
  averageScore: number;
  label: string;
  minimumScore: number;
  timestamp: number;
};

export type LiveTelemetryPoint = {
  capturedAt: string;
  confidenceScore: number;
  normalizedValue: number;
};

export type DashboardTelemetryStatus = {
  latestEventAt: string | null;
  latestIngestionRun: {
    acceptedRecordCount: number;
    completedAt: string | null;
    id: number;
    rejectedRecordCount: number;
    scenarioKinds: string[];
    seed: number | null;
    sourceLabel: string;
    startedAt: string;
    status: TableEnum<"ingestion_run_status">;
  } | null;
  latestScoreAt: string | null;
  latestTelemetryAt: string | null;
  monitoredCrewCount: number;
  pollingIntervalMs: number;
  totalCrewCount: number;
};

export type DashboardLiveResponse = {
  crews: CrewOverviewItem[];
  events: EventListItem[];
  fleetTrend: FleetTrendPoint[];
  focusCrewCode: string | null;
  focusTelemetry: {
    crewCode: string;
    crewDisplayName: string;
    series: CrewTelemetrySeries[];
  } | null;
  telemetryStatus: DashboardTelemetryStatus;
};

export type SummaryListItem = {
  id: number;
  crewCode: string | null;
  crewDisplayName: string | null;
  summaryText: string;
  scopeKind: TableEnum<"summary_scope_kind">;
  reviewStatus: TableEnum<"summary_review_status">;
  generatedAt: string;
  providerName: string;
  modelName: string;
  readinessScoreId: number | null;
};

export type SummaryListResponse = {
  summaries: SummaryListItem[];
};

export type SimulationControlResponse = {
  eventDetection: {
    eventCount: number;
    eventTypes: string[];
    normalizationVersion: string;
    ruleVersion: string;
  } | null;
  generated: {
    cadenceSeconds: number;
    crewCount: number;
    durationMinutes: number;
    scenarioKinds: string[];
    seed: number;
  };
  ingestion: {
    acceptedRecordCount: number;
    ingestionRunId: number;
    inputRecordCount: number;
    rejectedRecordCount: number;
    rejectionSamples: {
      capturedAt: string | null;
      crewCode: string | null;
      index: number;
      reason: string;
      signalType: string | null;
      sourceKey: string | null;
    }[];
    status: TableEnum<"ingestion_run_status">;
  };
  readinessScoring: {
    crewMemberCount: number;
    normalizationVersion: string;
    ruleVersion: string;
    scoreCount: number;
    scoreVersion: string;
  } | null;
};
