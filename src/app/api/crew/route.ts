import { listCrewOverviewWithServiceRole } from "@/lib/api/query";

export async function GET() {
  try {
    const result = await listCrewOverviewWithServiceRole();
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Crew overview lookup failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
