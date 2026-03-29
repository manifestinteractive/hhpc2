import {
  calculateReadinessScoresForIngestionRunWithServiceRole,
  parseReadinessScoringRequest,
  ReadinessScoringError,
} from "@/lib/processing";

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

  const parsed = parseReadinessScoringRequest(payload);

  if (!parsed.success) {
    return getBadRequestResponse(
      "Readiness scoring request is invalid.",
      parsed.error.flatten(),
    );
  }

  try {
    const result = await calculateReadinessScoresForIngestionRunWithServiceRole(parsed.data);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ReadinessScoringError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    const message =
      error instanceof Error ? error.message : "Readiness scoring failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
