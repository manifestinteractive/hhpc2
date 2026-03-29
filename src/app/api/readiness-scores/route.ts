import { z } from "zod";
import { listReadinessScoresWithServiceRole } from "@/lib/api/query";

const readinessFilterSchema = z.object({
  crewCode: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = readinessFilterSchema.safeParse({
    crewCode: url.searchParams.get("crewCode") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: "Readiness score query is invalid.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await listReadinessScoresWithServiceRole(parsed.data);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Readiness score lookup failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
