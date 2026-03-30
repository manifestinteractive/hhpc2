"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ChevronsUp } from "lucide-react";
import {
  ReadinessStatusBadge,
} from "@/components/dashboard/readiness-status-badge";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CrewOverviewItem } from "@/types/api";

function formatConfidence(value: number | null | undefined) {
  if (value == null) {
    return "N/A";
  }

  return `${Math.round(value * 100)}%`;
}

export function CrewReadinessTable({
  crews,
}: {
  crews: CrewOverviewItem[];
}) {
  const router = useRouter();

  function navigateToCrew(crewCode: string) {
    router.push(`/crew/${crewCode}`);
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-2xl">Crew board</CardTitle>
          <CardDescription>
            Lowest readiness rises to the top. High-severity activity is surfaced
            immediately.
          </CardDescription>
        </CardHeader>
        <div className="min-[1281px]:max-h-[42rem] min-[1281px]:overflow-y-auto min-[1281px]:pr-2">
          <div className="min-[1281px]:pb-6">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[35%]">Crew</TableHead>
                  <TableHead className="w-[25%] text-center">Readiness</TableHead>
                  <TableHead className="w-auto">AI summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crews.map((crew) => (
                  <TableRow
                    key={crew.crewCode}
                    aria-label={`Open detail for ${crew.displayName}`}
                    className="group cursor-pointer"
                    onClick={() => navigateToCrew(crew.crewCode)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateToCrew(crew.crewCode);
                      }
                    }}
                    role="link"
                    tabIndex={0}
                  >
                    <TableCell className="w-[35%] align-top">
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground font-semibold text-xl">
                          {crew.displayName}
                        </span>
                        <p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
                          {crew.callSign
                            ? `${crew.callSign}  |  ${crew.crewCode}`
                            : crew.crewCode}
                        </p>
                        <p className="text-muted-foreground text-sm leading-6">
                          {crew.roleTitle}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="w-[25%] whitespace-normal align-top">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <ReadinessStatusBadge
                          score={crew.latestReadiness?.compositeScore}
                        />
                        <div className="space-y-1">
                          <span className="text-xl font-semibold tabular-nums">
                            {crew.latestReadiness
                              ? (
                                  <AnimatedNumber
                                    value={Math.round(crew.latestReadiness.compositeScore)}
                                  />
                                )
                              : "N/A"}
                          </span>
                          <Tooltip>
                            <TooltipTrigger
                              className="mx-auto block text-sm text-muted-foreground tabular-nums"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              Confidence{" "}
                              {crew.latestReadiness?.confidenceModifier != null ? (
                                <AnimatedNumber
                                  suffix="%"
                                  value={Math.round(
                                    crew.latestReadiness.confidenceModifier * 100,
                                  )}
                                />
                              ) : (
                                formatConfidence(crew.latestReadiness?.confidenceModifier)
                              )}
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>
                              Confidence reflects signal quality and missing-data burden.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="w-auto whitespace-normal align-top">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p
                            className={
                              crew.summaryState === "ready"
                                ? "line-clamp-3 text-sm leading-6"
                                : crew.summaryState === "failed"
                                  ? "line-clamp-3 text-sm leading-6 text-destructive"
                                : "line-clamp-3 text-sm leading-6 text-muted-foreground"
                            }
                          >
                            {crew.latestSummary?.summaryText ?? crew.summaryStatusText}
                          </p>
                        </div>
                        <ArrowRight className="text-muted-foreground mt-0.5 size-8 shrink-0 translate-x-[-1rem] translate-y-[1.25rem] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        {crews.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm">
            <ChevronsUp className="size-4" />
            No crew telemetry is available yet. Trigger a simulation run to
            populate the board.
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
