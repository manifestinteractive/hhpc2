import type {
  CrewSummaryInputContext,
  SummaryGenerationOptions,
} from "@/lib/ai/types";

function buildCrewPromptPayload(input: CrewSummaryInputContext) {
  return {
    crew: {
      callSign: input.crew.callSign,
      crewCode: input.crew.crewCode,
      displayName: input.crew.displayName,
      roleTitle: input.crew.roleTitle,
    },
    readiness: {
      confidenceState: input.derivedAssessment.confidenceState,
      readinessBand: input.derivedAssessment.readinessBand,
    },
    assessment: {
      dataTrust: input.derivedAssessment.dataTrust,
      highSeverityEventCount: input.derivedAssessment.highSeverityEventCount,
      likelyCondition: input.derivedAssessment.likelyCondition,
      primaryConcern: input.derivedAssessment.primaryConcern,
    },
    dominantDrivers: input.dominantFactors.slice(0, 3),
    recentEvents: input.recentEvents.slice(0, 3).map((event) => ({
      eventType: event.eventType,
      explanation: event.explanation,
      severity: event.severity,
    })),
    signalSnapshots: input.signalSnapshots.slice(0, 4).map((signal) => ({
      confidencePercent: signal.confidencePercent,
      label: signal.label,
    })),
    telemetryWindow: {
      signalCount: input.telemetryWindow.signalCount,
    },
  };
}

export function buildSummaryInstructions(
  input: CrewSummaryInputContext,
  options: SummaryGenerationOptions = {},
) {
  const guidance = [
    "You are assisting a mission-readiness review dashboard.",
    "Write a concise operational summary for a crew member using only the structured context provided.",
    "Start with what is happening, not with names, timestamps, raw score dumps, or database-style recitation.",
    "Explain the most likely concern or explicitly say that no urgent concern is visible.",
    "Mention whether the telemetry is trustworthy enough to act on when that matters.",
    "Use 1 or 2 short sentences and keep the total under 55 words.",
    "Do not make medical diagnoses.",
    "Do not invent causes, values, or trends that are not present.",
    "Do not mention timestamps, IDs, exact decimal values, call signs, role titles, field names, JSON keys, or the phrase confidence modifier.",
    "Do not start by repeating the crew member's full name.",
    "No markdown.",
  ];

  guidance.push(
    "If the main issue is sensor reliability or missing data, say that explicitly.",
    "If the pattern looks like acute stress, fatigue, weak recovery, or thermal strain, say so in plain operational language.",
    "If the crew member is stable, say that there is no immediate concern rather than forcing a warning.",
  );

  if ((options.qualityFeedback?.length ?? 0) > 0) {
    guidance.push(
      `Fix the previous draft problems: ${options.qualityFeedback!.join("; ")}.`,
    );
  }

  return guidance.join(" ");
}

export function buildSummaryInput(input: CrewSummaryInputContext) {
  const payload = buildCrewPromptPayload(input);
  return ["Structured context JSON:", JSON.stringify(payload, null, 2)].join("\n");
}
