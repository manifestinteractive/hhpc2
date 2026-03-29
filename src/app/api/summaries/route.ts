import { z } from "zod";
import { listSummariesWithServiceRole } from "@/lib/api/query";

const summaryFilterSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  reviewStatus: z.enum(["approved", "dismissed", "pending"]).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = summaryFilterSchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    reviewStatus: url.searchParams.get("reviewStatus") ?? undefined,
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
