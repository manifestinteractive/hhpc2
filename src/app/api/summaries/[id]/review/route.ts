import { z } from "zod";
import { reviewSummary } from "@/lib/ai";

const reviewSchema = z.object({
  decision: z.enum(["approved", "dismissed"]),
  reviewNotes: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let payload: unknown = {};

  try {
    const rawBody = await request.text();
    payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    return Response.json(
      {
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const parsedBody = reviewSchema.safeParse(payload);
  const { id } = await params;
  const summaryId = Number(id);

  if (!Number.isInteger(summaryId) || summaryId <= 0) {
    return Response.json(
      {
        error: "Summary id is invalid.",
      },
      { status: 400 },
    );
  }

  if (!parsedBody.success) {
    return Response.json(
      {
        error: "Summary review request is invalid.",
        issues: parsedBody.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const summary = await reviewSummary({
      decision: parsedBody.data.decision,
      reviewNotes: parsedBody.data.reviewNotes,
      summaryId,
    });

    return Response.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Summary review failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
