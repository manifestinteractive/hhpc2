import { execFileSync } from "node:child_process";
import type { DatabaseClient } from "@/lib/db";

type LocalSupabaseStatus = {
  API_URL: string;
  SERVICE_ROLE_KEY: string;
};

function getLocalSupabaseStatus(): LocalSupabaseStatus {
  const raw = execFileSync("supabase", ["status", "-o", "json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Could not parse Supabase status output as JSON.");
  }

  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as LocalSupabaseStatus;

  if (!parsed.API_URL || !parsed.SERVICE_ROLE_KEY) {
    throw new Error(
      "Local Supabase status did not expose API_URL and SERVICE_ROLE_KEY.",
    );
  }

  return parsed;
}

function unwrapModuleExports<T>(module: T): T {
  if (
    module &&
    typeof module === "object" &&
    "default" in module &&
    module.default
  ) {
    return module.default as T;
  }

  if (
    module &&
    typeof module === "object" &&
    "module.exports" in module &&
    module["module.exports"]
  ) {
    return module["module.exports"] as T;
  }

  return module;
}

async function cleanup(client: DatabaseClient, ingestionRunId: number, scoreVersion: string) {
  const { data: rawRows } = await client
    .from("raw_readings")
    .select("id")
    .eq("ingestion_run_id", ingestionRunId);
  const rawReadingIds = (rawRows ?? []).map((row) => row.id);

  if (rawReadingIds.length > 0) {
    const { data: normalizedRows } = await client
      .from("normalized_readings")
      .select("id")
      .in("raw_reading_id", rawReadingIds);
    const normalizedIds = (normalizedRows ?? []).map((row) => row.id);

    if (normalizedIds.length > 0) {
      await client.from("detected_events").delete().in("normalized_reading_id", normalizedIds);
    }

    await client.from("normalized_readings").delete().in("raw_reading_id", rawReadingIds);
  }

  await client.from("readiness_scores").delete().eq("score_version", scoreVersion);
  await client
    .from("system_logs")
    .delete()
    .eq("related_table_name", "ingestion_runs")
    .eq("related_record_id", ingestionRunId);
  await client.from("raw_readings").delete().eq("ingestion_run_id", ingestionRunId);
  await client.from("ingestion_runs").delete().eq("id", ingestionRunId);
}

async function parseJsonResponse(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

async function main() {
  const { API_URL, SERVICE_ROLE_KEY } = getLocalSupabaseStatus();
  process.env.SUPABASE_URL = API_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  const [
    dbModule,
    crewRouteModule,
    crewDetailRouteModule,
    eventsRouteModule,
    readinessRouteModule,
    simulationControlRouteModule,
    summariesRouteModule,
  ] = await Promise.all([
    import("@/lib/db"),
    import("@/app/api/crew/route"),
    import("@/app/api/crew/[crewCode]/route"),
    import("@/app/api/events/route"),
    import("@/app/api/readiness-scores/route"),
    import("@/app/api/simulation/control/route"),
    import("@/app/api/summaries/route"),
  ]);
  const { createSupabaseServiceRoleClient } = unwrapModuleExports(
    dbModule,
  ) as typeof import("@/lib/db");
  const crewRoute = unwrapModuleExports(
    crewRouteModule,
  ) as typeof import("@/app/api/crew/route");
  const crewDetailRoute = unwrapModuleExports(
    crewDetailRouteModule,
  ) as typeof import("@/app/api/crew/[crewCode]/route");
  const eventsRoute = unwrapModuleExports(
    eventsRouteModule,
  ) as typeof import("@/app/api/events/route");
  const readinessRoute = unwrapModuleExports(
    readinessRouteModule,
  ) as typeof import("@/app/api/readiness-scores/route");
  const simulationControlRoute = unwrapModuleExports(
    simulationControlRouteModule,
  ) as typeof import("@/app/api/simulation/control/route");
  const summariesRoute = unwrapModuleExports(
    summariesRouteModule,
  ) as typeof import("@/app/api/summaries/route");

  if (
    !createSupabaseServiceRoleClient ||
    !crewRoute.GET ||
    !crewDetailRoute.GET ||
    !eventsRoute.GET ||
    !readinessRoute.GET ||
    !simulationControlRoute.POST ||
    !summariesRoute.GET
  ) {
    throw new Error("Could not resolve one or more API route exports for validation.");
  }

  const client = createSupabaseServiceRoleClient({
    key: SERVICE_ROLE_KEY,
    url: API_URL,
  });
  const scoreVersion = "api-validation-score-v1";
  const controlRequest = new Request("http://localhost:3000/api/simulation/control", {
    body: JSON.stringify({
      durationMinutes: 8,
      processSummaryJobsAfterResponse: false,
      ruleVersion: "api-validation-rules-v1",
      scoreVersion,
      seed: 57,
      sourceLabel: `api-validation-${Date.now()}`,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const controlResponse = await simulationControlRoute.POST(controlRequest);

  if (controlResponse.status !== 201) {
    throw new Error(`Simulation control route returned ${controlResponse.status}.`);
  }

  const controlPayload = await parseJsonResponse(controlResponse);
  const ingestion = controlPayload.ingestion as { ingestionRunId: number } | undefined;

  if (!ingestion?.ingestionRunId) {
    throw new Error("Simulation control response did not include an ingestion run id.");
  }

  try {
    const crewResponse = await crewRoute.GET();
    const crewPayload = await parseJsonResponse(crewResponse);
    const crews = crewPayload.crews as Array<{ crewCode: string }> | undefined;

    if (!crews || crews.length === 0) {
      throw new Error("Crew route did not return any crews.");
    }

    const crewCode = crews[0]?.crewCode ?? "CRW-001";
    const crewDetailResponse = await crewDetailRoute.GET(
      new Request(`http://localhost:3000/api/crew/${crewCode}`),
      {
        params: Promise.resolve({ crewCode }),
      },
    );
    const crewDetailPayload = await parseJsonResponse(crewDetailResponse);

    if (!("crew" in crewDetailPayload)) {
      throw new Error("Crew detail route did not return a crew payload.");
    }

    const eventsResponse = await eventsRoute.GET(
      new Request("http://localhost:3000/api/events?limit=10"),
    );
    const eventsPayload = await parseJsonResponse(eventsResponse);

    if (!Array.isArray(eventsPayload.events)) {
      throw new Error("Events route did not return an events array.");
    }

    const readinessResponse = await readinessRoute.GET(
      new Request("http://localhost:3000/api/readiness-scores?limit=10"),
    );
    const readinessPayload = await parseJsonResponse(readinessResponse);

    if (!Array.isArray(readinessPayload.scores) || readinessPayload.scores.length === 0) {
      throw new Error("Readiness scores route did not return scores.");
    }

    const summariesResponse = await summariesRoute.GET(
      new Request("http://localhost:3000/api/summaries?limit=10"),
    );
    const summariesPayload = await parseJsonResponse(summariesResponse);

    if (!Array.isArray(summariesPayload.summaries)) {
      throw new Error("Summaries route did not return a summaries array.");
    }

    console.log(
      JSON.stringify(
        {
          crew_count: crews.length,
          event_count: (eventsPayload.events as unknown[]).length,
          ingestion_run_id: ingestion.ingestionRunId,
          ok: true,
          readiness_score_count: (readinessPayload.scores as unknown[]).length,
          summaries_count: (summariesPayload.summaries as unknown[]).length,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup(client, ingestion.ingestionRunId, scoreVersion);
  }
}

void main();
