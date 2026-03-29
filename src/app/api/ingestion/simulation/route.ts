import { ingestSimulationRequest, parseSimulationIngestionRequest } from "@/lib/processing";

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

  const parsed = parseSimulationIngestionRequest(payload);

  if (!parsed.success) {
    return getBadRequestResponse(
      "Simulation ingestion request is invalid.",
      parsed.error.flatten(),
    );
  }

  try {
    const result = await ingestSimulationRequest(parsed.data);

    return Response.json(result, {
      status: result.status === "failed" ? 422 : 200,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Simulation ingestion failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
