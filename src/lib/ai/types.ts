import type { TableEnum } from "@/lib/db";

export type SummaryGenerationMeta = {
  modelName: string;
  providerName: string;
};

export type GeneratedSummaryResult = SummaryGenerationMeta & {
  summaryText: string;
};

export type SummaryGenerationOptions = {
  qualityFeedback?: string[];
};

export type CrewSummaryInputContext = {
  scopeKind: "crew_member";
  generatedAt: string;
  crew: {
    callSign: string | null;
    crewCode: string;
    displayName: string;
    roleTitle: string;
  };
  derivedAssessment: {
    confidencePercent: number | null;
    confidenceState: "actionable" | "insufficient" | "use_caution";
    dataTrust: string;
    highSeverityEventCount: number;
    likelyCondition: string;
    primaryConcern: string;
    readinessBand: "critical" | "stable" | "watch";
  };
  latestReadiness: {
    calculatedAt: string | null;
    compositeScore: number | null;
    confidenceModifier: number | null;
  };
  dominantFactors: Array<{
    label: string;
    score: number | null;
  }>;
  recentEvents: Array<{
    eventType: string;
    explanation: string;
    severity: TableEnum<"event_severity">;
    startedAt: string;
  }>;
  signalSnapshots: Array<{
    confidencePercent: number;
    label: string;
    normalizedUnit: string;
    normalizedValue: number;
  }>;
  telemetryWindow: {
    latestTelemetryAt: string | null;
    signalCount: number;
  };
};

export type SummaryScopeInput = CrewSummaryInputContext;

export type SummaryProvider = {
  generateSummary(
    input: SummaryScopeInput,
    options?: SummaryGenerationOptions,
  ): Promise<GeneratedSummaryResult>;
};
