"use client";

import {
  Activity,
  AlertTriangle,
  Clock3,
  Dices,
  PauseCircle,
  PlayCircle,
  Radio,
  RefreshCw,
  Siren,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardTelemetryStatus, SimulationControlResponse } from "@/types/api";
import type { CrewOverviewItem } from "@/types/api";

type ScenarioMode =
  | "random"
  | "baseline"
  | "acute_stress"
  | "fatigue_trend"
  | "recovery_pattern"
  | "sensor_dropout";

const scenarioOptions: Array<{
  description: string;
  icon: typeof Activity;
  label: string;
  value: ScenarioMode;
}> = [
  {
    description: "Generate a steady-state telemetry window with normal operating conditions.",
    icon: Activity,
    label: "Baseline",
    value: "baseline",
  },
  {
    description: "Inject a sudden spike pattern to simulate acute operational strain.",
    icon: Siren,
    label: "Acute stress",
    value: "acute_stress",
  },
  {
    description: "Shift recovery markers downward to simulate accumulating fatigue.",
    icon: AlertTriangle,
    label: "Fatigue trend",
    value: "fatigue_trend",
  },
  {
    description: "Simulate intermittent sensor loss and reduced data trust.",
    icon: Radio,
    label: "Sensor dropout",
    value: "sensor_dropout",
  },
  {
    description: "Generate a rebound window showing improving recovery conditions.",
    icon: Zap,
    label: "Recovery",
    value: "recovery_pattern",
  },
  {
    description: "Pick one of the live incident presets at random for each cycle.",
    icon: Dices,
    label: "Random",
    value: "random",
  },
];

function formatTime(value: string | null) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function SimulationControlPanel({
  crews,
  isAutoFeedEnabled,
  isRunningSimulation,
  lastError,
  lastRun,
  onRunNow,
  onToggleAutoFeed,
  selectedScenario,
  status,
  onScenarioChange,
}: {
  crews: CrewOverviewItem[];
  isAutoFeedEnabled: boolean;
  isRunningSimulation: boolean;
  lastError: string | null;
  lastRun: SimulationControlResponse | null;
  onRunNow: () => void;
  onToggleAutoFeed: () => void;
  onScenarioChange: (scenario: ScenarioMode) => void;
  selectedScenario: ScenarioMode;
  status: DashboardTelemetryStatus;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          className="w-full"
          disabled={isRunningSimulation && !isAutoFeedEnabled}
          onClick={onToggleAutoFeed}
          size="lg"
          variant="default"
        >
          {isAutoFeedEnabled ? (
            <>
              <PauseCircle className="size-4" />
              Pause live feed
            </>
          ) : (
            <>
              <PlayCircle className="size-4" />
              {isRunningSimulation ? "Starting live feed..." : "Start live feed"}
            </>
          )}
        </Button>
        <Button
          className="w-full border-border/70 bg-background/80 text-foreground transition-colors hover:bg-muted disabled:opacity-70"
          disabled={isRunningSimulation}
          onClick={onRunNow}
          size="lg"
          variant="outline"
        >
          <RefreshCw
            className={`size-4 ${isRunningSimulation ? "animate-spin" : ""}`}
          />
          {isRunningSimulation ? "Running cycle..." : "Run one cycle"}
        </Button>
      </div>

      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Scenario preset
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {scenarioOptions.map((option) => {
            const Icon = option.icon;
            const isActive = selectedScenario === option.value;

            return (
              <button
                key={option.value}
                aria-busy={isRunningSimulation && isActive}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/70 bg-background/80 text-foreground hover:bg-muted"
                }`}
                disabled={isRunningSimulation}
                onClick={() => onScenarioChange(option.value)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" />
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
                <p
                  className={`mt-3 text-sm leading-6 ${
                    isActive ? "text-background/82" : "text-muted-foreground"
                  }`}
                >
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="px-2 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Feed status
            </p>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {isAutoFeedEnabled ? <Activity className="size-4" /> : <Clock3 className="size-4" />}
              {isAutoFeedEnabled ? "Running" : "Paused"}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Active scenario
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {scenarioOptions.find((option) => option.value === selectedScenario)?.label}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Coverage
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {status.monitoredCrewCount}/{status.totalCrewCount} crew
              </p>
            </div>
          </div>
        </div>

        <div className="px-2 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Telemetry
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatTime(status.latestTelemetryAt)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Score
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatTime(status.latestScoreAt)}
              </p>
            </div>
          </div>
          {status.latestIngestionRun ? (
            <div className="mt-4 border-t border-border/70 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>Last run</span>
                <span className="font-medium capitalize text-foreground">
                  {status.latestIngestionRun.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                <span>{status.latestIngestionRun.acceptedRecordCount} accepted</span>
                <span>{status.latestIngestionRun.rejectedRecordCount} rejected</span>
                <span>{status.latestIngestionRun.scenarioKinds.join(", ") || "baseline"}</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="px-2 py-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Run feedback
        </p>
        {lastError ? (
          <p className="mt-2 text-sm leading-6 text-destructive">{lastError}</p>
        ) : lastRun ? (
          <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
            <p>
              Latest cycle processed {lastRun.ingestion.acceptedRecordCount} of{" "}
              {lastRun.ingestion.inputRecordCount} generated records across{" "}
              {lastRun.generated.crewCount} crew members.
            </p>
            <p>
              Event count {lastRun.eventDetection?.eventCount ?? 0}, score count{" "}
              {lastRun.readinessScoring?.scoreCount ?? 0}.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use Run one cycle to push new telemetry through ingestion, normalization,
            event detection, and readiness scoring.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>{crews.length} crew in rotation</span>
          <span>{isRunningSimulation ? "Cycle in progress..." : "Ready for next cycle"}</span>
        </div>
      </section>
    </div>
  );
}
