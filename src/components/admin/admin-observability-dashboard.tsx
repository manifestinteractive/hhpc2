import type { AdminObservabilityResponse } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AdminObservabilityDashboardProps = {
  snapshot: AdminObservabilityResponse;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No data yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPercent(value: number | null) {
  return value == null ? "N/A" : `${value.toFixed(1)}%`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getHealthBadgeVariant(status: "degraded" | "healthy" | "unconfigured") {
  switch (status) {
    case "healthy":
      return "stable";
    case "degraded":
      return "watch";
    default:
      return "secondary";
  }
}

function getRunBadgeVariant(status: AdminObservabilityResponse["ingestionMonitoring"]["recentRuns"][number]["status"]) {
  switch (status) {
    case "completed":
      return "stable";
    case "failed":
      return "critical";
    case "partially_completed":
      return "watch";
    default:
      return "secondary";
  }
}

function getLogBadgeVariant(level: AdminObservabilityResponse["failureLogs"]["recentLogs"][number]["level"]) {
  switch (level) {
    case "error":
      return "critical";
    case "warn":
      return "watch";
    default:
      return "secondary";
  }
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

export function AdminObservabilityDashboard({
  snapshot,
}: AdminObservabilityDashboardProps) {
  const { aiSummaryQueue, dataQuality, failureLogs, ingestionMonitoring, systemHealth } =
    snapshot;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-5 py-8 min-[1281px]:justify-center min-[1281px]:px-8">
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Observability and admin</CardTitle>
              <CardDescription>
                Hidden route for ingestion health, queue behavior, and failure
                diagnosis. This surface is intentionally not linked from the
                main product UI. Refreshed {formatTimestamp(snapshot.generatedAt)}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryStat
                label="Env status"
                value={systemHealth.environment.status}
              />
              <SummaryStat
                label="Runs last 24h"
                value={formatCount(ingestionMonitoring.totalsLast24Hours.totalRuns)}
              />
              <SummaryStat
                label="Error logs"
                value={formatCount(failureLogs.totalsLast24Hours.error)}
              />
              <SummaryStat
                label="Queue failed"
                value={formatCount(aiSummaryQueue.counts.failed)}
              />
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Latest system activity</CardTitle>
              <CardDescription>
                Recent heartbeat across ingestion, telemetry, scoring, summaries,
                and system logging.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <SummaryStat
                label="Latest ingestion"
                value={formatTimestamp(systemHealth.latestActivity.latestIngestionAt)}
              />
              <SummaryStat
                label="Latest telemetry"
                value={formatTimestamp(systemHealth.latestActivity.latestTelemetryAt)}
              />
              <SummaryStat
                label="Latest score"
                value={formatTimestamp(systemHealth.latestActivity.latestScoreAt)}
              />
              <SummaryStat
                label="Latest summary"
                value={formatTimestamp(systemHealth.latestActivity.latestSummaryAt)}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>System health</CardTitle>
              <CardDescription>
                Environment readiness and dependency checks exposed by the
                existing health layer.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Environment contract
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Required keys missing:{" "}
                      {formatCount(systemHealth.environment.missingRequiredKeys.length)}
                    </p>
                  </div>
                  <Badge
                    variant={getHealthBadgeVariant(systemHealth.environment.status)}
                  >
                    {systemHealth.environment.status}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3">
                {systemHealth.dependencies.map((dependency) => (
                  <div
                    key={dependency.name}
                    className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium capitalize text-foreground">
                          {dependency.name}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {dependency.summary}
                        </p>
                      </div>
                      <Badge variant={getHealthBadgeVariant(dependency.status)}>
                        {dependency.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Ingestion monitoring</CardTitle>
              <CardDescription>
                Success rate, rejection volume, and the most recent ingestion
                windows.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryStat
                  label="Success rate"
                  value={formatPercent(
                    ingestionMonitoring.totalsLast24Hours.successRatePercent,
                  )}
                />
                <SummaryStat
                  label="Failed runs"
                  value={formatCount(ingestionMonitoring.totalsLast24Hours.failed)}
                />
                <SummaryStat
                  label="Rejected records"
                  value={formatCount(
                    ingestionMonitoring.totalsLast24Hours.rejectedRecordCount,
                  )}
                />
                <SummaryStat
                  label="Partial runs"
                  value={formatCount(ingestionMonitoring.totalsLast24Hours.partial)}
                />
              </div>

              <div className="max-h-[28rem] overflow-y-auto pr-1">
                <div className="grid gap-3 pb-4">
                  {ingestionMonitoring.recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Run #{run.id} · {run.sourceLabel}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {run.runKind}
                            {run.scenarioKinds.length > 0
                              ? ` · ${run.scenarioKinds.join(", ")}`
                              : ""}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            Started {formatTimestamp(run.startedAt)}
                            {run.completedAt
                              ? ` · completed ${formatTimestamp(run.completedAt)}`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Input {formatCount(run.inputRecordCount)} · accepted{" "}
                            {formatCount(run.acceptedRecordCount)} · rejected{" "}
                            {formatCount(run.rejectedRecordCount)}
                          </p>
                          {run.errorSummary ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--color-critical)]">
                              {run.errorSummary}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant={getRunBadgeVariant(run.status)}>
                          {run.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Failure logs</CardTitle>
              <CardDescription>
                Recent system logs with level totals for the last 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryStat
                  label="Errors"
                  value={formatCount(failureLogs.totalsLast24Hours.error)}
                />
                <SummaryStat
                  label="Warnings"
                  value={formatCount(failureLogs.totalsLast24Hours.warn)}
                />
                <SummaryStat
                  label="Info"
                  value={formatCount(failureLogs.totalsLast24Hours.info)}
                />
                <SummaryStat
                  label="Debug"
                  value={formatCount(failureLogs.totalsLast24Hours.debug)}
                />
              </div>

              <div className="max-h-[28rem] overflow-y-auto pr-1">
                <div className="grid gap-3 pb-4">
                  {failureLogs.recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {log.message}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {log.component} · {log.eventType}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {formatTimestamp(log.createdAt)}
                            {log.relatedTableName
                              ? ` · ${log.relatedTableName} #${log.relatedRecordId ?? "?"}`
                              : ""}
                          </p>
                        </div>
                        <Badge variant={getLogBadgeVariant(log.level)}>
                          {log.level}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Data quality indicators</CardTitle>
                <CardDescription>
                  Confidence and anomaly signals from the most recent telemetry
                  and scoring windows.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <SummaryStat
                  label="Avg readiness confidence"
                  value={formatPercent(
                    dataQuality.averageReadinessConfidencePercent,
                  )}
                />
                <SummaryStat
                  label="Low-confidence score windows"
                  value={formatCount(dataQuality.lowConfidenceReadinessCount)}
                />
                <SummaryStat
                  label="Affected crew"
                  value={formatCount(dataQuality.affectedCrewCount)}
                />
                <SummaryStat
                  label="Low-confidence telemetry"
                  value={formatPercent(dataQuality.lowConfidenceTelemetryRatePercent)}
                />
              </CardContent>
              <CardContent className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-3">
                <SummaryStat
                  label="High events"
                  value={formatCount(dataQuality.eventCountsLast24Hours.high)}
                />
                <SummaryStat
                  label="Medium events"
                  value={formatCount(dataQuality.eventCountsLast24Hours.medium)}
                />
                <SummaryStat
                  label="Low events"
                  value={formatCount(dataQuality.eventCountsLast24Hours.low)}
                />
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>AI summary queue</CardTitle>
                <CardDescription>
                  Queue health for async summary generation and recent failed
                  jobs.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryStat
                  label="Pending"
                  value={formatCount(aiSummaryQueue.counts.pending)}
                />
                <SummaryStat
                  label="Running"
                  value={formatCount(aiSummaryQueue.counts.running)}
                />
                <SummaryStat
                  label="Failed"
                  value={formatCount(aiSummaryQueue.counts.failed)}
                />
                <SummaryStat
                  label="Completed"
                  value={formatCount(aiSummaryQueue.counts.completed)}
                />
                <SummaryStat
                  label="Stale pending"
                  value={formatCount(aiSummaryQueue.stalePendingCount)}
                />
              </CardContent>
              <CardContent className="max-h-[20rem] overflow-y-auto border-t border-border/70 pt-4">
                <div className="grid gap-3 pb-4">
                  {aiSummaryQueue.recentFailedJobs.length === 0 ? (
                    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
                      No failed summary jobs in the recent queue window.
                    </div>
                  ) : (
                    aiSummaryQueue.recentFailedJobs.map((job) => (
                      <div
                        key={job.id}
                        className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {job.crewDisplayName ?? "Unknown crew"}
                              {job.crewCode ? ` · ${job.crewCode}` : ""}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Enqueued {formatTimestamp(job.enqueuedAt)}
                              {job.startedAt
                                ? ` · started ${formatTimestamp(job.startedAt)}`
                                : ""}
                            </p>
                            {job.lastError ? (
                              <p className="mt-2 text-xs leading-5 text-[color:var(--color-critical)]">
                                {job.lastError}
                              </p>
                            ) : null}
                          </div>
                          <Badge variant="critical">
                            failed x{job.attemptCount}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
