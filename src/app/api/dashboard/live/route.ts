import { getDashboardLiveSnapshotWithServiceRole } from "@/lib/api/query";

function getBadRequestResponse(message: string) {
  return Response.json(
    {
      error: message,
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const focusCrewCode = searchParams.get("focusCrewCode")?.trim() || undefined;

  if (focusCrewCode != null && focusCrewCode.length === 0) {
    return getBadRequestResponse("focusCrewCode must be a non-empty string.");
  }

  try {
    const snapshot = await getDashboardLiveSnapshotWithServiceRole(focusCrewCode);
    return Response.json(snapshot, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dashboard live query failed.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
