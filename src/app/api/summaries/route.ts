import { z } from "zod";
import { listSummariesWithServiceRole } from "@/lib/api/query";

const summaryFilterSchema = z.object({
  crewCode: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  reviewStatus: z.enum(["approved", "dismissed", "pending"]).optional(),
  scopeKind: z.enum(["crew_member", "fleet"]).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = summaryFilterSchema.safeParse({
    crewCode: url.searchParams.get("crewCode") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    reviewStatus: url.searchParams.get("reviewStatus") ?? undefined,
    scopeKind: url.searchParams.get("scopeKind") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: "Summary query is invalid.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await listSummariesWithServiceRole(parsed.data);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Summary lookup failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
