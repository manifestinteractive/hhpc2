"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Gauge,
  Settings2,
  ShieldAlert,
  Siren,
  Radio,
  ArrowUpRight,
} from "lucide-react";
import { CrewReadinessTable } from "@/components/dashboard/crew-readiness-table";
import { FleetReadinessTrendChart } from "@/components/dashboard/fleet-readiness-trend-chart";
import { MissionStatCard } from "@/components/dashboard/mission-stat-card";
import {
  EventSeverityBadge,
  ReadinessStatusBadge,
} from "@/components/dashboard/readiness-status-badge";
import { SimulationControlPanel } from "@/components/dashboard/simulation-control-panel";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { sortCrewByRisk } from "@/lib/dashboard";
import type { DashboardLiveResponse, SimulationControlResponse } from "@/types/api";

type ScenarioMode =
  | "random"
  | "baseline"
  | "acute_stress"
  | "fatigue_trend"
  | "recovery_pattern"
  | "sensor_dropout";

type IncidentScenarioMode = Exclude<ScenarioMode, "baseline" | "random">;

type ActiveIncidentSession = {
  elapsedMinutes: number;
  resolvedScenario: IncidentScenarioMode;
  seed: number;
  startedAt: string;
  targetCrewCode: string;
};

const AUTO_FEED_INTERVAL_MS = 15000;
const randomScenarioOptions: IncidentScenarioMode[] = [
  "acute_stress",
  "fatigue_trend",
  "recovery_pattern",
  "sensor_dropout",
];

const scenarioRunConfig: Record<
  Exclude<ScenarioMode, "random">,
  {
    cadenceSeconds: number;
    cycleStepMinutes: number;
    initialElapsedMinutes: number;
    intensity: number;
    leadInMinutes: number;
    missingRate: number;
    noiseScale: number;
    windowDurationMinutes: number;
  }
> = {
  acute_stress: {
    cadenceSeconds: 30,
    cycleStepMinutes: 6,
    initialElapsedMinutes: 18,
    intensity: 1.7,
    leadInMinutes: 12,
    missingRate: 0.003,
    noiseScale: 0.5,
    windowDurationMinutes: 48,
  },
  baseline: {
    cadenceSeconds: 30,
    cycleStepMinutes: 0,
    initialElapsedMinutes: 0,
    intensity: 1,
    leadInMinutes: 30,
    missingRate: 0.001,
    noiseScale: 0.35,
    windowDurationMinutes: 0,
  },
  fatigue_trend: {
    cadenceSeconds: 30,
    cycleStepMinutes: 10,
    initialElapsedMinutes: 36,
    intensity: 1.6,
    leadInMinutes: 16,
    missingRate: 0.003,
    noiseScale: 0.55,
    windowDurationMinutes: 140,
  },
  recovery_pattern: {
    cadenceSeconds: 30,
    cycleStepMinutes: 8,
    initialElapsedMinutes: 28,
    intensity: 1.2,
    leadInMinutes: 16,
    missingRate: 0.002,
    noiseScale: 0.45,
    windowDurationMinutes: 110,
  },
  sensor_dropout: {
    cadenceSeconds: 30,
    cycleStepMinutes: 6,
    initialElapsedMinutes: 14,
    intensity: 1.35,
    leadInMinutes: 10,
    missingRate: 0.02,
    noiseScale: 0.4,
    windowDurationMinutes: 90,
  },
};

function formatEventType(eventType: string) {
  return eventType.replaceAll("_", " ");
}

function getRollingSeed() {
  return Math.floor(Date.now() % 2_147_483_647);
}

function buildSimulationRequest(
  crews: DashboardLiveResponse["crews"],
  scenario: ScenarioMode,
  activeIncident?: ActiveIncidentSession | null,
) {
  const baselineCrewCodes = crews.map((crew) => crew.crewCode);

  if (scenario === "baseline" || !activeIncident) {
    const baselinePreset = scenarioRunConfig.baseline;
    const durationMinutes = 60;

    return {
      cadenceSeconds: baselinePreset.cadenceSeconds,
      crewCodes: baselineCrewCodes,
      durationMinutes,
      missingRate: baselinePreset.missingRate,
      noiseScale: baselinePreset.noiseScale,
      scenarios: [],
      seed: getRollingSeed(),
      sourceLabel: "dashboard-control",
      startAt: new Date(Date.now() - durationMinutes * 60_000).toISOString(),
      timestampJitterSeconds: 12,
    };
  }

  const preset = scenarioRunConfig[activeIncident.resolvedScenario];
  const incidentStartedAt = Date.parse(activeIncident.startedAt);
  const leadInMinutes = preset.leadInMinutes;
  const simulationStartAt = new Date(
    incidentStartedAt - leadInMinutes * 60_000,
  );
  const durationMinutes = Math.max(
    leadInMinutes + activeIncident.elapsedMinutes,
    leadInMinutes + 12,
  );

  return {
    cadenceSeconds: preset.cadenceSeconds,
    crewCodes: baselineCrewCodes,
    durationMinutes,
    missingRate: preset.missingRate,
    noiseScale: preset.noiseScale,
    scenarios: [
      {
        crewCodes: [activeIncident.targetCrewCode],
        durationMinutes: preset.windowDurationMinutes,
        intensity: preset.intensity,
        kind: activeIncident.resolvedScenario,
        startOffsetMinutes: leadInMinutes,
      },
    ],
    seed: activeIncident.seed,
    sourceLabel: "dashboard-control",
    startAt: simulationStartAt.toISOString(),
    timestampJitterSeconds: 12,
  };
}

function pickScenarioTargetCrewCode(
  crews: DashboardLiveResponse["crews"],
  excludeCrewCode?: string | null,
) {
  if (crews.length === 0) {
    return null;
  }

  const eligibleCrews =
    excludeCrewCode != null
      ? crews.filter((crew) => crew.crewCode !== excludeCrewCode)
      : crews;
  const pool = eligibleCrews.length > 0 ? eligibleCrews : crews;
  const randomIndex = Math.floor(Math.random() * pool.length);

  return pool[randomIndex]?.crewCode ?? crews[0]?.crewCode ?? null;
}

function pickRandomIncidentScenario() {
  const randomIndex = Math.floor(Math.random() * randomScenarioOptions.length);
  return randomScenarioOptions[randomIndex] ?? "acute_stress";
}

function createIncidentSession(
  crews: DashboardLiveResponse["crews"],
  selectedScenario: Exclude<ScenarioMode, "baseline">,
  excludeCrewCode?: string | null,
): ActiveIncidentSession | null {
  const targetCrewCode = pickScenarioTargetCrewCode(crews, excludeCrewCode);

  if (!targetCrewCode) {
    return null;
  }

  const resolvedScenario: IncidentScenarioMode =
    selectedScenario === "random"
      ? pickRandomIncidentScenario()
      : selectedScenario;
  const preset = scenarioRunConfig[resolvedScenario];

  return {
    elapsedMinutes: preset.initialElapsedMinutes,
    resolvedScenario,
    seed: getRollingSeed(),
    startedAt: new Date().toISOString(),
    targetCrewCode,
  };
}

function advanceIncidentSession(
  incident: ActiveIncidentSession,
): ActiveIncidentSession {
  const preset = scenarioRunConfig[incident.resolvedScenario];

  return {
    ...incident,
    elapsedMinutes: Math.min(
      incident.elapsedMinutes + preset.cycleStepMinutes,
      preset.windowDurationMinutes,
    ),
  };
}

export function LiveDashboardShell({
  initialSnapshot,
}: {
  initialSnapshot: DashboardLiveResponse;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedScenario, setSelectedScenario] =
    useState<ScenarioMode>("baseline");
  const [activeIncident, setActiveIncident] =
    useState<ActiveIncidentSession | null>(null);
  const [isAutoFeedEnabled, setIsAutoFeedEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [lastRun, setLastRun] = useState<SimulationControlResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const previousScenarioRef = useRef<ScenarioMode>("baseline");
  const activeIncidentRef = useRef<ActiveIncidentSession | null>(null);

  const apiBaseUrl =
    typeof window === "undefined" ? "" : window.location.origin;

  const refreshSnapshot = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/dashboard/live`, {
        cache: "no-store",
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Unable to refresh dashboard telemetry.");
      }

      const nextSnapshot = (await response.json()) as DashboardLiveResponse;
      startTransition(() => {
        setSnapshot(nextSnapshot);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to refresh dashboard telemetry.";
      setLastError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    activeIncidentRef.current = activeIncident;
  }, [activeIncident]);

  useEffect(() => {
    const previousScenario = previousScenarioRef.current;
    previousScenarioRef.current = selectedScenario;

    if (selectedScenario === "baseline") {
      if (activeIncident !== null) {
        setActiveIncident(null);
      }
      return;
    }

    const crewStillExists =
      activeIncident != null &&
      snapshot.crews.some(
        (crew) => crew.crewCode === activeIncident.targetCrewCode,
      );

    if (previousScenario !== selectedScenario || !crewStillExists) {
      setActiveIncident((current) =>
        createIncidentSession(
          snapshot.crews,
          selectedScenario,
          current?.targetCrewCode ?? activeIncident?.targetCrewCode ?? null,
        ),
      );
    }
  }, [activeIncident, selectedScenario, snapshot.crews]);

  const runSimulationCycle = useCallback(async () => {
    if (isRunningSimulation) {
      return;
    }

    setIsRunningSimulation(true);
    setLastError(null);

    try {
      const nextIncident =
        selectedScenario === "baseline"
          ? null
          : selectedScenario === "random"
            ? createIncidentSession(
                snapshot.crews,
                selectedScenario,
                activeIncidentRef.current?.targetCrewCode ?? null,
              )
            : activeIncidentRef.current
              ? advanceIncidentSession(activeIncidentRef.current)
              : createIncidentSession(snapshot.crews, selectedScenario);

      if (selectedScenario !== "baseline" && !nextIncident) {
        throw new Error("No crew available for the selected incident scenario.");
      }

      if (selectedScenario !== "baseline" && nextIncident) {
        setActiveIncident(nextIncident);
      }

      const response = await fetch(`${apiBaseUrl}/api/simulation/control`, {
        body: JSON.stringify(
          buildSimulationRequest(
            snapshot.crews,
            selectedScenario,
            nextIncident,
          ),
        ),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const failure = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(failure?.error ?? "Simulation control failed.");
      }

      const result = (await response.json()) as SimulationControlResponse;
      setLastRun(result);
      await refreshSnapshot();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Simulation control failed.";
      setLastError(message);
    } finally {
      setIsRunningSimulation(false);
    }
  }, [
    apiBaseUrl,
    isRunningSimulation,
    refreshSnapshot,
    selectedScenario,
    snapshot.crews,
  ]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshSnapshot();
    }, snapshot.telemetryStatus.pollingIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshSnapshot, snapshot.telemetryStatus.pollingIntervalMs]);

  useEffect(() => {
    if (!isAutoFeedEnabled) {
      return;
    }

    void runSimulationCycle();

    const interval = window.setInterval(() => {
      void runSimulationCycle();
    }, AUTO_FEED_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isAutoFeedEnabled, runSimulationCycle]);

  const crews = sortCrewByRisk(snapshot.crews);
  const monitoredCrewCount = snapshot.telemetryStatus.monitoredCrewCount;
  const highEventCount = snapshot.events.filter(
    (event) => event.severity === "high",
  ).length;
  const crewsInWatchState = crews.filter((crew) => {
    const score = crew.latestReadiness?.compositeScore;
    return score != null && score < 75;
  }).length;
  const focusCrew =
    (snapshot.focusCrewCode
      ? crews.find((crew) => crew.crewCode === snapshot.focusCrewCode) ?? null
      : null) ??
    crews[0] ??
    null;
  const isFleetReady =
    crews.length > 0 &&
    monitoredCrewCount === crews.length &&
    crewsInWatchState === 0 &&
    highEventCount === 0;
  const lowestReadinessHelp = (
    <>
      <p>
        This is the lowest current readiness score across the monitored crew in
        the active dashboard window.
      </p>
      <p>
        It helps surface the crew member carrying the greatest immediate
        readiness risk, even when the rest of the roster is healthy.
      </p>
    </>
  );
  const reviewHelp = (
    <>
      <p>
        This count tracks how many crew members are currently in the watch or
        critical readiness bands.
      </p>
      <p>
        A value above zero means at least one crew member should be reviewed
        before lower-priority movement.
      </p>
    </>
  );
  const highEventsHelp = (
    <>
      <p>
        High events are the most operationally significant detected conditions
        in the current dashboard window.
      </p>
      <p>
        These can include acute strain, recovery problems, or telemetry
        reliability issues that materially affect mission review.
      </p>
    </>
  );
  const coverageHelp = (
    <>
      <p>
        Coverage shows how many crew members currently have recent readiness
        calculations available for review.
      </p>
      <p>
        Full coverage means telemetry has completed ingestion, processing, and
        scoring for the whole monitored roster.
      </p>
    </>
  );

  function renderMissionStats(className: string) {
    return (
      <section className={className}>
        <MissionStatCard
          detail="Crew currently carrying the lowest readiness and highest event burden."
          helpContent={lowestReadinessHelp}
          helpTitle="Lowest readiness"
          icon={Gauge}
          label="Lowest"
          value={
            focusCrew?.latestReadiness
              ? (
                  <AnimatedNumber
                    value={Math.round(focusCrew.latestReadiness.compositeScore)}
                  />
                )
              : "N/A"
          }
        />
        <MissionStatCard
          detail="Crew currently inside watch or critical readiness bands."
          helpContent={reviewHelp}
          helpTitle="Crews to review"
          icon={ShieldAlert}
          label="Review"
          value={<AnimatedNumber value={crewsInWatchState} />}
        />
        <MissionStatCard
          detail="High-severity detected events in the current dashboard window."
          helpContent={highEventsHelp}
          helpTitle="High events"
          icon={Siren}
          label="High events"
          value={<AnimatedNumber value={highEventCount} />}
        />
        <MissionStatCard
          detail="Crew with recent readiness calculations available for review."
          helpContent={coverageHelp}
          helpTitle="Telemetry coverage"
          icon={Radio}
          label="Coverage"
          value={
            <span>
              <AnimatedNumber value={monitoredCrewCount} />/{crews.length}
            </span>
          }
        />
      </section>
    );
  }

  function renderFocusCard(extraClassName?: string) {
    return (
      <Card
        className={`min-w-0 border-border/80 bg-card/95 shadow-sm ${extraClassName ?? ""}`}
      >
        <CardHeader>
          <CardTitle>{isFleetReady ? "Fleet ready" : "At-risk focus"}</CardTitle>
          <CardDescription>
            {isFleetReady
              ? "All monitored crew members are currently in the stable operating band."
              : "The crew member at the top of the watch list."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFleetReady ? (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <ReadinessStatusBadge score={100} />
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Full telemetry coverage
                  </span>
                </div>
                <h2 className="text-2xl font-semibold">All crew currently ready</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Recent telemetry is fully scored, no crew members are in watch
                  or critical status, and there are no active high-severity
                  events in the current window.
                </p>
              </div>

              <div className="grid gap-4 min-[1281px]:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Stable crew
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-5xl font-semibold tabular-nums">
                      <AnimatedNumber value={crews.length} />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      of {crews.length}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    High events
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-5xl font-semibold tabular-nums">
                      <AnimatedNumber value={0} />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      active
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : focusCrew ? (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <ReadinessStatusBadge
                    score={focusCrew.latestReadiness?.compositeScore}
                  />
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {focusCrew.callSign
                      ? `${focusCrew.callSign}  |  ${focusCrew.crewCode}`
                      : focusCrew.crewCode}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold">
                  {focusCrew.displayName}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {focusCrew.roleTitle}
                </p>
              </div>

              <div
                className={`grid gap-4 ${
                  focusCrew.latestEvent ? "min-[1281px]:grid-cols-2" : ""
                }`}
              >
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                  <div className="flex gap-3">
                    <span className="text-5xl font-semibold tabular-nums">
                      {focusCrew.latestReadiness
                        ? (
                            <AnimatedNumber
                              value={Math.round(
                                focusCrew.latestReadiness.compositeScore,
                              )}
                            />
                          )
                        : "N/A"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Readiness<br/>
                      Confidence{" "}
                      {focusCrew.latestReadiness
                        ? (
                            <AnimatedNumber
                              suffix="%"
                              value={Math.round(
                                focusCrew.latestReadiness.confidenceModifier * 100,
                              )}
                            />
                          )
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {focusCrew.latestEvent ? (
                  <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                    <div className="flex gap-3 items-center">
                      <span>
                        <EventSeverityBadge
                          severity={focusCrew.latestEvent.severity}
                        />
                      </span>
                      <p className="font-medium capitalize text-foreground">
                        {formatEventType(focusCrew.latestEvent.eventType)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <Button asChild className="w-full" size="lg">
                <Link href={`/crew/${focusCrew.crewCode}`}>
                  Open crew detail
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No crew detail is available yet.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderFleetTrendCard(extraClassName?: string) {
    return (
      <Card
        className={`border-border/80 bg-card/95 shadow-sm ${extraClassName ?? ""}`}
      >
        <CardHeader>
          <CardTitle>Fleet readiness trend</CardTitle>
          <CardDescription>
            Average fleet score and lowest single-crew score across recent
            scoring windows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FleetReadinessTrendChart points={snapshot.fleetTrend} />
        </CardContent>
      </Card>
    );
  }

  function renderEventWatchCard(extraClassName?: string) {
    return (
      <Card
        className={`border-border/80 bg-card/95 pb-0 shadow-sm ${extraClassName ?? ""}`}
      >
        <CardHeader>
          <CardTitle>Event watch</CardTitle>
          <CardDescription>
            Latest detected events, ordered by recency.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[25rem] overflow-y-auto min-[1281px]:max-h-[19rem]">
          <div className="flex flex-col gap-3 pb-4">
            {snapshot.events.length > 0 ? (
              snapshot.events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium capitalize text-foreground">
                        {formatEventType(event.eventType)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.crewDisplayName ?? "Unassigned crew"}
                      </p>
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {event.explanation}
                      </p>
                    </div>
                    <EventSeverityBadge severity={event.severity} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No events detected yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <main className="bg-background min-h-screen">
      <Sheet>
        <Tooltip>
          <TooltipTrigger
            render={(
              <SheetTrigger
                aria-label="Open mission feed controls"
                className="fixed right-4 top-4 z-50 inline-flex size-12 items-center justify-center rounded-full border border-border/80 bg-card/95 p-0 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:right-6 sm:top-6"
              />
            )}
          >
            <Settings2 className="size-5" />
          </TooltipTrigger>
          <TooltipContent>Open mission feed control</TooltipContent>
        </Tooltip>
        <SheetContent className="overflow-y-auto p-0">
          <SheetHeader>
            <SheetTitle>Mission feed control</SheetTitle>
            <SheetDescription>
              Trigger fresh telemetry windows, switch operating scenarios,
              and test how the dashboard responds under changing crew
              conditions.
            </SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <SimulationControlPanel
              crews={snapshot.crews}
              isAutoFeedEnabled={isAutoFeedEnabled}
              isRunningSimulation={isRunningSimulation || isRefreshing}
              lastError={lastError}
              lastRun={lastRun}
              onRunNow={() => {
                void runSimulationCycle();
              }}
              onScenarioChange={setSelectedScenario}
              onToggleAutoFeed={() => {
                setIsAutoFeedEnabled((current) => !current);
              }}
              selectedScenario={selectedScenario}
              status={snapshot.telemetryStatus}
            />
          </div>
        </SheetContent>
      </Sheet>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 md:px-10 lg:px-12 min-[1281px]:min-h-screen min-[1281px]:max-w-[1760px] min-[1281px]:justify-center min-[1281px]:py-6">
        {renderMissionStats("grid gap-4 md:grid-cols-2 xl:grid-cols-4 min-[1281px]:hidden")}

        <section className="grid gap-6 min-[1281px]:hidden xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
          <Card className="min-w-0 border-border/80 bg-card/95 pb-0 shadow-sm">
            <CardContent className="px-6 pt-6 pb-0">
              <CrewReadinessTable crews={crews} />
            </CardContent>
          </Card>

          {renderFocusCard()}
        </section>

        <section className="grid gap-6 min-[1281px]:hidden xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
          {renderFleetTrendCard()}
          {renderEventWatchCard()}
        </section>

        <section className="hidden min-[1281px]:grid min-[1281px]:grid-cols-[26rem_minmax(0,1.2fr)_22rem] min-[1281px]:items-start min-[1281px]:gap-6">
          <div className="grid gap-6">
            {renderFocusCard("min-[1281px]:max-h-[28rem]")}
            {renderMissionStats("grid grid-cols-2 gap-4")}
          </div>

          <Card className="min-w-0 border-border/80 bg-card/95 pb-0 shadow-sm min-[1281px]:max-h-[calc(100vh-7rem)] min-[1281px]:overflow-hidden">
            <CardContent className="h-full px-6 pt-6 pb-0">
              <CrewReadinessTable crews={crews} />
            </CardContent>
          </Card>

          <div className="grid gap-6">
            {renderFleetTrendCard()}
            {renderEventWatchCard()}
          </div>
        </section>
      </section>
    </main>
  );
}
