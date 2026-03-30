"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleX, LoaderCircle, SquareCheckBig } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SummaryDetail } from "@/types/api";

type SummaryState = "failed" | "pending" | "ready" | "unavailable";

function getSummaryTextClassName(summaryState: SummaryState, hasSummary: boolean) {
  if (hasSummary) {
    return "text-sm leading-6 text-foreground";
  }

  if (summaryState === "failed") {
    return "text-sm leading-6 text-destructive";
  }

  return "text-sm leading-6 text-muted-foreground";
}

function getReactionButtonClassName(
  isActive: boolean,
  tone: "critical" | "stable",
) {
  const toneClasses =
    tone === "stable"
      ? "hover:border-[color:var(--color-stable)] hover:bg-[color:var(--color-stable)]/10 hover:text-[color:var(--color-stable)]"
      : "hover:border-[color:var(--color-critical)] hover:bg-[color:var(--color-critical)]/10 hover:text-[color:var(--color-critical)]";
  const activeClasses =
    tone === "stable"
      ? "border-[color:var(--color-stable)] bg-[color:var(--color-stable)]/10 text-[color:var(--color-stable)]"
      : "border-[color:var(--color-critical)] bg-[color:var(--color-critical)]/10 text-[color:var(--color-critical)]";

  return cn(
    "inline-flex size-8 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
    toneClasses,
    isActive && activeClasses,
  );
}

export function CrewSummaryFeedback({
  summary,
  summaryState,
  summaryStatusText,
}: {
  summary: SummaryDetail | null;
  summaryState: SummaryState;
  summaryStatusText: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<
    "approved" | "dismissed" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function submitReview(decision: "approved" | "dismissed") {
    if (isSubmitting || !summary) {
      return;
    }

    setIsSubmitting(true);
    setPendingDecision(decision);
    setError(null);

    try {
      const response = await fetch(`/api/summaries/${summary.id}/review`, {
        body: JSON.stringify({ decision }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Summary review failed.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Summary review failed.",
      );
    } finally {
      setIsSubmitting(false);
      setPendingDecision(null);
    }
  }

  return (
    <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          AI Summary
        </p>

        <p className={getSummaryTextClassName(summaryState, summary != null)}>
          {summary?.summaryText ?? summaryStatusText}
        </p>

        {error ? (
          <p className="text-sm text-[color:var(--color-critical)]">{error}</p>
        ) : null}

        {summary ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tooltip>
              <TooltipTrigger
                aria-label="This summary was accurate"
                className={getReactionButtonClassName(
                  summary.reviewStatus === "approved",
                  "stable",
                )}
                disabled={isSubmitting}
                onClick={() => {
                  void submitReview("approved");
                }}
                type="button"
              >
                {isSubmitting && pendingDecision === "approved" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <SquareCheckBig className="size-4" />
                )}
              </TooltipTrigger>
              <TooltipContent>This summary was accurate</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                aria-label="This summary was inaccurate"
                className={getReactionButtonClassName(
                  summary.reviewStatus === "dismissed",
                  "critical",
                )}
                disabled={isSubmitting}
                onClick={() => {
                  void submitReview("dismissed");
                }}
                type="button"
              >
                {isSubmitting && pendingDecision === "dismissed" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CircleX className="size-4" />
                )}
              </TooltipTrigger>
              <TooltipContent>This summary was inaccurate</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </div>
    </div>
  );
}
