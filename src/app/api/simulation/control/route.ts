import { after } from "next/server";
import { processPendingSummaryJobsWithServiceRole } from "@/lib/ai";
import { parseSimulationControlRequest, runSimulationControl } from "@/lib/api/simulation-control";

function getBadRequestResponse(message: string, issues?: unknown) {
  return Response.json(
    {
      error: message,
      issues,
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  let payload: unknown = {};

  try {
    const rawBody = await request.text();
    payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    return getBadRequestResponse("Request body must be valid JSON.");
  }

  const parsed = parseSimulationControlRequest(payload);

  if (!parsed.success) {
    return getBadRequestResponse(
      "Simulation control request is invalid.",
      parsed.error.flatten(),
    );
  }

  try {
    const result = await runSimulationControl(parsed.data);
    after(async () => {
      await processPendingSummaryJobsWithServiceRole();
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Simulation control failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
