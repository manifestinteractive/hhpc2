import { z } from "zod";
import { listEventsWithServiceRole } from "@/lib/api/query";

const eventFilterSchema = z.object({
  crewCode: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  severity: z.enum(["high", "medium", "low"]).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = eventFilterSchema.safeParse({
    crewCode: url.searchParams.get("crewCode") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    severity: url.searchParams.get("severity") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: "Event query is invalid.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await listEventsWithServiceRole(parsed.data);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Event lookup failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
