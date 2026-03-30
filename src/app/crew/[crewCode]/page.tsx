import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  HeartPulse,
  ShieldAlert,
  ChevronsUp,
} from "lucide-react";
import {
  EventSeverityBadge,
  ReadinessStatusBadge,
} from "@/components/dashboard/readiness-status-badge";
import { CrewHistoryTabsCard } from "@/components/dashboard/crew-history-tabs-card";
import { CrewSummaryFeedback } from "@/components/dashboard/crew-summary-feedback";
import { MissionStatCard } from "@/components/dashboard/mission-stat-card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildReadinessProfile,
  buildSignalDeviationSeries,
  formatFactorLabel,
  getDominantFactors,
} from "@/lib/dashboard";
import { getCrewDetailWithServiceRole } from "@/lib/api/query";

function formatEventType(eventType: string) {
  return eventType.replaceAll("_", " ");
}

function describeReadiness(score: number | null | undefined) {
  if (score == null) {
    return "This crew does not have a current score yet. Run telemetry through processing to generate one.";
  }

  if (score < 55) {
    return "Scores below 55 mean immediate review is warranted. Recent telemetry and events are pointing to sustained strain or weak recovery.";
  }

  if (score < 75) {
    return "Scores from 55 to 74 indicate caution. The crew member is operational, but the latest signals are drifting away from baseline.";
  }

  return "Scores of 75 or higher indicate stable operating conditions. Continue monitoring for trend deterioration rather than immediate intervention.";
}

function describeFactor(factor: string) {
  switch (factor) {
    case "cardiovascular":
      return "Compares the latest heart rate and heart-rate variability against this crew member's baseline.";
    case "recovery":
      return "Reflects recent sleep duration and sleep quality, which heavily influence mission readiness.";
    case "thermal_stability":
      return "Tracks whether body temperature is holding near the expected baseline range.";
    case "activity_balance":
      return "Measures how current activity level compares with the crew member's expected movement target.";
    case "data_quality":
      return "Accounts for missing, imputed, or low-confidence telemetry so weak inputs cannot look stronger than they are.";
    default:
      return "This factor is one of the strongest current drivers of the final readiness score.";
  }
}

function getComponentScore(
  scoreComponents: unknown,
  factor: string,
) {
  if (!scoreComponents || typeof scoreComponents !== "object" || Array.isArray(scoreComponents)) {
    return null;
  }

  const component = (scoreComponents as Record<string, unknown>)[factor];

  if (!component || typeof component !== "object" || Array.isArray(component)) {
    return null;
  }

  const score = (component as Record<string, unknown>).score;
  return typeof score === "number" ? Math.round(score) : null;
}

export default async function CrewDetailPage({
  params,
}: {
  params: Promise<{
    crewCode: string;
  }>;
}) {
  const { crewCode } = await params;
  const detail = await getCrewDetailWithServiceRole(crewCode);

  if (!detail) {
    notFound();
  }

  const signalDeviation = buildSignalDeviationSeries(detail);
  const readinessProfile = buildReadinessProfile(detail);
  const dominantFactors = getDominantFactors(detail);
  const highSeverityEventCount = detail.recentEvents.filter(
    (event) => event.severity === "high",
  ).length;
  const roundedReadinessScore =
    detail.latestReadiness != null
      ? Math.round(detail.latestReadiness.compositeScore)
      : null;
  const roundedConfidence =
    detail.latestReadiness != null
      ? Math.round(detail.latestReadiness.confidenceModifier * 100)
      : null;
  const currentScoreHelp = (
    <>
      <p>
        {roundedReadinessScore != null
          ? `${roundedReadinessScore} / 100 readiness`
          : "No current readiness score"}
      </p>
      <p>{describeReadiness(detail.latestReadiness?.compositeScore)}</p>
      <p>
        The score blends cardiovascular strain, recovery, temperature
        stability, activity balance, data quality, and recent detected events.
      </p>
    </>
  );
  const confidenceHelp = (
    <>
      <p>
        Confidence reflects how trustworthy the latest score is given signal
        quality, coverage, and missing-data burden.
      </p>
      <p>
        {roundedConfidence != null
          ? `${roundedConfidence}% confidence means the current score is supported by mostly complete telemetry.`
          : "Confidence will appear after scoring has run for this crew."}
      </p>
      <p>
        Lower confidence usually means more imputed or degraded inputs were
        needed to keep the readiness score current.
      </p>
    </>
  );
  const highEventsHelp = (
    <>
      <p>
        This count tracks high-severity detected events in the current event
        watch window for this crew member.
      </p>
      <p>
        High events are mission-relevant anomalies or reliability issues that
        can materially lower readiness and prompt faster review.
      </p>
    </>
  );
  const signalFeedsHelp = (
    <>
      <p>
        Signal feeds are the latest normalized telemetry streams available for
        mission review.
      </p>
      <p>
        More available feeds generally means broader coverage across the crew
        member’s physiology and better context for scoring decisions.
      </p>
    </>
  );

  return (
    <main className="bg-background min-h-screen">
      <Tooltip>
        <TooltipTrigger
          render={(
            <Link
              aria-label="Back to dashboard"
              className="fixed left-4 top-4 z-50 inline-flex size-12 items-center justify-center rounded-full border border-border/80 bg-card/95 p-0 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:left-6 sm:top-6"
              href="/"
            />
          )}
        >
          <ArrowLeft className="size-5" />
        </TooltipTrigger>
        <TooltipContent>Back to dashboard</TooltipContent>
      </Tooltip>
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 md:px-10 lg:px-12 min-[1281px]:min-h-screen min-[1281px]:max-w-[1760px] min-[1281px]:justify-center min-[1281px]:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <ReadinessStatusBadge
                  score={detail.latestReadiness?.compositeScore}
                />
                <span className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
                  {detail.crew.callSign
                    ? `${detail.crew.callSign}  |  ${detail.crew.crewCode}  |  ${detail.crew.roleTitle}`
                    : detail.crew.crewCode}
                </span>
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  {detail.crew.displayName}
                </h1>
              </div>
            </div>
          </div>

          <div className="py-2">
            <p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
              Current readiness score
            </p>
            <div className="mt-2 flex items-end gap-3">
              <span className="text-5xl font-semibold tabular-nums">
                {detail.latestReadiness
                  ? (
                      <AnimatedNumber
                        value={Math.round(detail.latestReadiness.compositeScore)}
                      />
                    )
                  : "N/A"}
              </span>
              <span className="text-muted-foreground text-sm">
                confidence{" "}
                {detail.latestReadiness
                  ? (
                      <AnimatedNumber
                        suffix="%"
                        value={Math.round(
                          detail.latestReadiness.confidenceModifier * 100,
                        )}
                      />
                    )
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 min-[1281px]:hidden">
          <MissionStatCard
            detail=""
            helpContent={currentScoreHelp}
            helpTitle="Current score"
            icon={HeartPulse}
            label="Current score"
            value={
              detail.latestReadiness
                ? (
                    <AnimatedNumber
                      value={Math.round(detail.latestReadiness.compositeScore)}
                    />
                  )
                : "N/A"
            }
          />
          <MissionStatCard
            detail=""
            helpContent={confidenceHelp}
            helpTitle="Confidence"
            icon={ShieldAlert}
            label="Confidence"
            value={
              detail.latestReadiness
                ? (
                    <AnimatedNumber
                      suffix="%"
                      value={Math.round(
                        detail.latestReadiness.confidenceModifier * 100,
                      )}
                    />
                  )
                : "N/A"
            }
          />
          <MissionStatCard
            detail=""
            helpContent={highEventsHelp}
            helpTitle="High events"
            icon={ChevronsUp}
            label="High events"
            value={<AnimatedNumber value={highSeverityEventCount} />}
          />
          <MissionStatCard
            detail=""
            helpContent={signalFeedsHelp}
            helpTitle="Signal feeds"
            icon={Activity}
            label="Signal feeds"
            value={<AnimatedNumber value={detail.signalSnapshots.length} />}
          />
        </section>

        <section className="grid gap-6 min-[1281px]:hidden xl:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-6">
            <CrewHistoryTabsCard
              events={detail.recentEvents}
              readinessProfile={readinessProfile}
              scores={detail.readinessHistory}
              signalDeviation={signalDeviation}
              telemetry={detail.telemetryHistory}
            />
          </div>

          <div className="grid gap-6">
            <Card className="border-border/80 bg-card/95 pb-0 shadow-sm">
              <CardHeader>
                <CardTitle>What is driving this score</CardTitle>
                <CardDescription>
                  The strongest current downward pressures.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <CrewSummaryFeedback
                  summary={detail.latestSummary}
                  summaryState={detail.summaryState}
                  summaryStatusText={detail.summaryStatusText}
                />
                {dominantFactors.length > 0 ? (
                  dominantFactors.map((factor) => (
                    <div
                      key={factor}
                      className="rounded-xl border border-border/70 bg-background/80 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-foreground font-medium">
                            {formatFactorLabel(factor)}
                          </p>
                          <p className="text-muted-foreground text-sm leading-6">
                            {describeFactor(factor)}
                          </p>
                        </div>
                        <div className="rounded-full border border-border/70 bg-card px-3 py-1 text-sm font-semibold tabular-nums text-foreground">
                          {getComponentScore(detail.latestReadiness?.scoreComponents, factor) ?? "N/A"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Breakdown data will appear after scoring has run for this
                    crew.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>Recent events</CardTitle>
                <CardDescription>
                  The most recent detected conditions affecting this crew.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[22rem] overflow-y-auto">
                <div className="flex flex-col gap-3 pb-4">
                  {detail.recentEvents.length > 0 ? (
                    detail.recentEvents.slice(0, 8).map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl border border-border/70 bg-background/80 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="font-medium capitalize text-foreground">
                              {formatEventType(event.eventType)}
                            </p>
                            <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
                              {event.explanation}
                            </p>
                          </div>
                          <EventSeverityBadge severity={event.severity} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No recent detected events for this crew.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="hidden min-[1281px]:grid min-[1281px]:grid-cols-[15rem_minmax(0,1.2fr)_24rem] min-[1281px]:items-start min-[1281px]:gap-6">
          <div className="grid gap-8">
            <MissionStatCard
              detail=""
              helpContent={currentScoreHelp}
              helpTitle="Current score"
              icon={HeartPulse}
              label="Current score"
              value={
                detail.latestReadiness
                  ? (
                      <AnimatedNumber
                        value={Math.round(detail.latestReadiness.compositeScore)}
                      />
                    )
                  : "N/A"
              }
            />
            <MissionStatCard
              detail=""
              helpContent={confidenceHelp}
              helpTitle="Confidence"
              icon={ShieldAlert}
              label="Confidence"
              value={
                detail.latestReadiness
                  ? (
                      <AnimatedNumber
                        suffix="%"
                        value={Math.round(
                          detail.latestReadiness.confidenceModifier * 100,
                        )}
                      />
                    )
                  : "N/A"
              }
            />
            <MissionStatCard
              detail=""
              helpContent={highEventsHelp}
              helpTitle="High events"
              icon={ChevronsUp}
              label="High events"
              value={<AnimatedNumber value={highSeverityEventCount} />}
            />
            <MissionStatCard
              detail=""
              helpContent={signalFeedsHelp}
              helpTitle="Signal feeds"
              icon={Activity}
              label="Signal feeds"
              value={<AnimatedNumber value={detail.signalSnapshots.length} />}
            />
          </div>

          <div className="grid gap-6">
            <CrewHistoryTabsCard
              className="min-[1281px]:h-[38rem]"
              events={detail.recentEvents}
              readinessProfile={readinessProfile}
              scores={detail.readinessHistory}
              signalDeviation={signalDeviation}
              telemetry={detail.telemetryHistory}
            />
          </div>

          <div className="grid gap-6 min-[1281px]:h-[38rem] min-[1281px]:grid-rows-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <Card className="border-border/80 bg-card/95 shadow-sm min-[1281px]:flex min-[1281px]:h-full min-[1281px]:flex-col min-[1281px]:pb-0">
              <CardHeader>
                <CardTitle>What is driving this score</CardTitle>
                <CardDescription>
                  The strongest current downward pressures.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[22rem] overflow-y-auto min-[1281px]:max-h-none min-[1281px]:flex-1">
                <div className="flex flex-col gap-4 pb-4">
                  <CrewSummaryFeedback
                    summary={detail.latestSummary}
                    summaryState={detail.summaryState}
                    summaryStatusText={detail.summaryStatusText}
                  />
                  {dominantFactors.length > 0 ? (
                    dominantFactors.map((factor) => (
                      <div
                        key={factor}
                        className="rounded-xl border border-border/70 bg-background/80 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-foreground font-medium">
                              {formatFactorLabel(factor)}
                            </p>
                            <p className="text-muted-foreground text-sm leading-6">
                              {describeFactor(factor)}
                            </p>
                          </div>
                          <div className="rounded-full border border-border/70 bg-card px-3 py-1 text-sm font-semibold tabular-nums text-foreground">
                            {getComponentScore(detail.latestReadiness?.scoreComponents, factor) ?? "N/A"}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Breakdown data will appear after scoring has run for this
                      crew.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-sm min-[1281px]:flex min-[1281px]:h-full min-[1281px]:flex-col min-[1281px]:pb-0">
              <CardHeader>
                <CardTitle>Recent events</CardTitle>
                <CardDescription>
                  The most recent detected conditions affecting this crew.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[16rem] overflow-y-auto min-[1281px]:max-h-none min-[1281px]:flex-1">
                <div className="flex flex-col gap-3 pb-4">
                  {detail.recentEvents.length > 0 ? (
                    detail.recentEvents.slice(0, 8).map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl border border-border/70 bg-background/80 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="font-medium capitalize text-foreground">
                              {formatEventType(event.eventType)}
                            </p>
                            <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
                              {event.explanation}
                            </p>
                          </div>
                          <EventSeverityBadge severity={event.severity} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No recent detected events for this crew.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </section>
    </main>
  );
}
