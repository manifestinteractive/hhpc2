import { describe, expect, it } from "vitest";
import {
  buildSummaryInput,
  buildSummaryInstructions,
} from "@/lib/ai/prompts";
import type { CrewSummaryInputContext } from "@/lib/ai/types";

const crewInput: CrewSummaryInputContext = {
  crew: {
    callSign: "VECTOR",
    crewCode: "CRW-004",
    displayName: "Jordan Brooks",
    roleTitle: "Payload Specialist",
  },
  derivedAssessment: {
    confidencePercent: 82,
    confidenceState: "use_caution",
    dataTrust: "Telemetry confidence is acceptable for review, but the pattern is mixed.",
    highSeverityEventCount: 1,
    likelyCondition: "acute stress pattern",
    primaryConcern:
      "Cardiovascular strain is the clearest current concern and is consistent with acute stress.",
    readinessBand: "watch",
  },
  dominantFactors: [
    {
      label: "Cardiovascular",
      score: 41,
    },
  ],
  generatedAt: "2026-03-30T05:15:00.000Z",
  latestReadiness: {
    calculatedAt: "2026-03-30T05:14:00.000Z",
    compositeScore: 58,
    confidenceModifier: 0.82,
  },
  recentEvents: [
    {
      eventType: "elevated heart rate",
      explanation: "Heart rate is well above baseline for the current window.",
      severity: "high",
      startedAt: "2026-03-30T05:00:00.000Z",
    },
  ],
  scopeKind: "crew_member",
  signalSnapshots: [
    {
      confidencePercent: 92,
      label: "Heart Rate",
      normalizedUnit: "bpm",
      normalizedValue: 94,
    },
  ],
  telemetryWindow: {
    latestTelemetryAt: "2026-03-30T05:14:30.000Z",
    signalCount: 6,
  },
};

describe("buildSummaryInstructions", () => {
  it("uses crew-specific guidance for crew summaries", () => {
    const instructions = buildSummaryInstructions(crewInput);

    expect(instructions).toContain("crew member");
    expect(instructions).toContain("Do not make medical diagnoses.");
    expect(instructions).toContain("Use 1 or 2 short sentences");
    expect(instructions).toContain("Do not start by repeating the crew member's full name.");
    expect(instructions).toContain("structured context provided");
  });
});

describe("buildSummaryInput", () => {
  it("serializes the structured input context as JSON", () => {
    const payload = buildSummaryInput(crewInput);

    expect(payload).toContain("Structured context JSON:");
    expect(payload).toContain("\"crewCode\": \"CRW-004\"");
    expect(payload).toContain("\"likelyCondition\": \"acute stress pattern\"");
    expect(payload).not.toContain("2026-03-30T05:14:00.000Z");
  });
});
