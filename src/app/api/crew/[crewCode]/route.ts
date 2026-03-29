import { getCrewDetailWithServiceRole } from "@/lib/api/query";

type RouteContext = {
  params: Promise<{
    crewCode: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { crewCode } = await context.params;

  try {
    const result = await getCrewDetailWithServiceRole(crewCode);

    if (!result) {
      return Response.json(
        {
          error: `Crew member ${crewCode} was not found.`,
        },
        { status: 404 },
      );
    }

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Crew detail lookup failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
