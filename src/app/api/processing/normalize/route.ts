import {
  NormalizationError,
  normalizeIngestionRunWithServiceRole,
  parseNormalizationRequest,
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

  const parsed = parseNormalizationRequest(payload);

  if (!parsed.success) {
    return getBadRequestResponse(
      "Normalization request is invalid.",
      parsed.error.flatten(),
    );
  }

  try {
    const result = await normalizeIngestionRunWithServiceRole(parsed.data);

    return Response.json(result);
  } catch (error) {
    if (error instanceof NormalizationError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    const message =
      error instanceof Error ? error.message : "Normalization failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
