import { processPendingSummaryJobsWithServiceRole } from "@/lib/ai";

export async function POST() {
  try {
    const result = await processPendingSummaryJobsWithServiceRole();

    return Response.json(
      {
        backfilledCount: result.backfilledCount,
        completedCount: result.completedCount,
        failedCount: result.failedCount,
        processedCount: result.processedCount,
      },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Summary processing failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
