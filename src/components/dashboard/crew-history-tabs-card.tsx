"use client";

import { useState } from "react";
import { LiveTelemetryChart } from "@/components/dashboard/live-telemetry-chart";
import { ReadinessProfileChart } from "@/components/dashboard/readiness-profile-chart";
import { ReadinessHistoryChart } from "@/components/dashboard/readiness-history-chart";
import { SignalDeviationChart } from "@/components/dashboard/signal-deviation-chart";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  CrewTelemetryBundle,
  EventListItem,
  ReadinessScoreItem,
} from "@/types/api";

export function CrewHistoryTabsCard({
  events,
  readinessProfile,
  signalDeviation,
  scores,
  telemetry,
  className,
}: {
  events: EventListItem[];
  readinessProfile: {
    label: string;
    score: number;
  }[];
  scores: ReadinessScoreItem[];
  telemetry: CrewTelemetryBundle | null;
  className?: string;
  signalDeviation: {
    baseline: number | null;
    confidenceScore: number;
    label: string;
    normalizedUnit: string;
    observed: number;
    variancePercent: number;
  }[];
}) {
  const [activeTab, setActiveTab] = useState<
    "live" | "profile" | "readiness" | "signals"
  >("profile");

  return (
    <Tabs
      className="h-full min-w-0 gap-0"
      defaultValue="profile"
      onValueChange={(value) => {
        if (
          value === "live" ||
          value === "readiness" ||
          value === "signals" ||
          value === "profile"
        ) {
          setActiveTab(value);
        }
      }}
      value={activeTab}
    >
      <Card
        className={cn(
          "min-w-0 overflow-hidden border-border/80 bg-card/95 shadow-sm min-[1281px]:flex min-[1281px]:h-full min-[1281px]:flex-col",
          className,
        )}
      >
        <CardHeader className="gap-3 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-6">
          <TabsList className="grid !h-auto min-w-0 w-full auto-rows-fr items-stretch gap-2 bg-transparent p-0 min-[380px]:grid-cols-2 sm:grid-cols-4">
            <TabsTrigger
              value="profile"
              className="h-auto min-w-0 whitespace-normal rounded-full border border-border/70 bg-transparent px-3 py-2 text-center text-sm leading-tight text-foreground after:hidden hover:bg-muted data-active:!border-foreground data-active:!bg-foreground data-active:!text-background"
            >
              Readiness profile
            </TabsTrigger>
            <TabsTrigger
              value="live"
              className="h-auto min-w-0 whitespace-normal rounded-full border border-border/70 bg-transparent px-3 py-2 text-center text-sm leading-tight text-foreground after:hidden hover:bg-muted data-active:!border-foreground data-active:!bg-foreground data-active:!text-background"
            >
              Live feed
            </TabsTrigger>
            <TabsTrigger
              value="readiness"
              className="h-auto min-w-0 whitespace-normal rounded-full border border-border/70 bg-transparent px-3 py-2 text-center text-sm leading-tight text-foreground after:hidden hover:bg-muted data-active:!border-foreground data-active:!bg-foreground data-active:!text-background"
            >
              Score trend
            </TabsTrigger>
            <TabsTrigger
              value="signals"
              className="h-auto min-w-0 whitespace-normal rounded-full border border-border/70 bg-transparent px-3 py-2 text-center text-sm leading-tight text-foreground after:hidden hover:bg-muted data-active:!border-foreground data-active:!bg-foreground data-active:!text-background"
            >
              Signal shifts
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="min-w-0 px-4 pb-4 sm:px-6 sm:pb-6 min-[1281px]:flex min-[1281px]:flex-1 min-[1281px]:overflow-hidden">
          {activeTab === "profile" ? (
            <div className="min-w-0 space-y-4 min-[1281px]:flex min-[1281px]:h-full min-[1281px]:flex-1 min-[1281px]:flex-col">
              <div className="min-w-0 min-[1281px]:flex-1">
                <ReadinessProfileChart points={readinessProfile} />
              </div>
            </div>
          ) : activeTab === "live" ? (
            <div className="min-w-0 space-y-4 min-[1281px]:flex min-[1281px]:h-full min-[1281px]:flex-1 min-[1281px]:flex-col">
              <div className="min-w-0 min-[1281px]:flex-1">
                <LiveTelemetryChart telemetry={telemetry} />
              </div>
            </div>
          ) : activeTab === "readiness" ? (
            <div className="min-w-0 space-y-4 min-[1281px]:flex min-[1281px]:h-full min-[1281px]:flex-1 min-[1281px]:flex-col">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Score trend</h2>
                <p className="text-muted-foreground text-sm leading-6">
                  The score line shows overall readiness. Confidence and event
                  markers show whether the system trusts the telemetry behind it.
                </p>
              </div>
              <div className="min-w-0 min-[1281px]:flex-1">
                <ReadinessHistoryChart events={events} scores={scores} />
              </div>
            </div>
          ) : activeTab === "signals" ? (
            <div className="min-w-0 space-y-4 min-[1281px]:flex min-[1281px]:h-full min-[1281px]:flex-1 min-[1281px]:flex-col">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Signal shifts</h2>
                <p className="text-muted-foreground text-sm leading-6">
                  Each bar compares the latest processed signal with this crew
                  member&apos;s normal baseline, so unusual movement stands out
                  fast.
                </p>
              </div>
              <div className="min-w-0 min-[1281px]:flex-1">
                <SignalDeviationChart points={signalDeviation} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Tabs>
  );
}
