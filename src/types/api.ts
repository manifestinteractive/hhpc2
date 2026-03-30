import type { Json, TableEnum } from "@/lib/db";
import type { DependencyReport, EnvironmentSummary } from "@/types/app";

export type CrewOverviewItem = {
  crewCode: string;
  displayName: string;
  callSign: string | null;
  roleTitle: string;
  latestReadiness: {
    id: number;
    calculatedAt: string;
    compositeScore: number;
    confidenceModifier: number;
    scoreVersion: string;
  } | null;
  latestSummary: SummaryDetail | null;
  summaryState: "failed" | "pending" | "ready" | "unavailable";
  summaryStatusText: string;
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
    id: number;
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
  latestSummary: SummaryDetail | null;
  summaryState: "failed" | "pending" | "ready" | "unavailable";
  summaryStatusText: string;
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

export type AdminLatestActivity = {
  latestIngestionAt: string | null;
  latestLogAt: string | null;
  latestScoreAt: string | null;
  latestSummaryAt: string | null;
  latestTelemetryAt: string | null;
};

export type AdminIngestionRunItem = {
  acceptedRecordCount: number;
  completedAt: string | null;
  errorSummary: string | null;
  id: number;
  inputRecordCount: number;
  rejectedRecordCount: number;
  runKind: TableEnum<"ingestion_run_kind">;
  scenarioKinds: string[];
  seed: number | null;
  sourceLabel: string;
  startedAt: string;
  status: TableEnum<"ingestion_run_status">;
};

export type AdminSystemLogItem = {
  component: string;
  createdAt: string;
  details: Json;
  eventType: string;
  id: number;
  level: TableEnum<"system_log_level">;
  message: string;
  relatedRecordId: number | null;
  relatedTableName: string | null;
};

export type AdminSummaryJobItem = {
  attemptCount: number;
  completedAt: string | null;
  crewCode: string | null;
  crewDisplayName: string | null;
  enqueuedAt: string;
  id: number;
  lastError: string | null;
  readinessScoreId: number;
  startedAt: string | null;
  status: TableEnum<"ai_summary_job_status">;
};

export type AdminObservabilityResponse = {
  aiSummaryQueue: {
    counts: {
      completed: number;
      failed: number;
      pending: number;
      running: number;
    };
    recentFailedJobs: AdminSummaryJobItem[];
    stalePendingCount: number;
  };
  dataQuality: {
    affectedCrewCount: number;
    averageReadinessConfidencePercent: number | null;
    eventCountsLast24Hours: {
      high: number;
      low: number;
      medium: number;
    };
    lowConfidenceReadinessCount: number;
    lowConfidenceTelemetryRatePercent: number | null;
  };
  failureLogs: {
    recentLogs: AdminSystemLogItem[];
    totalsLast24Hours: {
      debug: number;
      error: number;
      info: number;
      warn: number;
    };
  };
  generatedAt: string;
  ingestionMonitoring: {
    recentRuns: AdminIngestionRunItem[];
    totalsLast24Hours: {
      acceptedRecordCount: number;
      completed: number;
      failed: number;
      partial: number;
      pending: number;
      rejectedRecordCount: number;
      running: number;
      successRatePercent: number | null;
      totalRuns: number;
    };
  };
  systemHealth: {
    dependencies: DependencyReport[];
    environment: EnvironmentSummary;
    latestActivity: AdminLatestActivity;
  };
};

export type SummaryListItem = {
  id: number;
  crewCode: string | null;
  crewDisplayName: string | null;
  structuredInputContext: Json;
  summaryText: string;
  scopeKind: TableEnum<"summary_scope_kind">;
  reviewStatus: TableEnum<"summary_review_status">;
  generatedAt: string;
  providerName: string;
  modelName: string;
  readinessScoreId: number | null;
  reviewedAt: string | null;
};

export type SummaryDetail = SummaryListItem;

export type SummaryListResponse = {
  summaries: SummaryListItem[];
};

export type SummaryReviewResponse = {
  summary: SummaryDetail;
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
