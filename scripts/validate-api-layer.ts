import { execFileSync } from "node:child_process";
import { GET as getCrewRoute } from "@/app/api/crew/route";
import { GET as getCrewDetailRoute } from "@/app/api/crew/[crewCode]/route";
import { GET as getEventsRoute } from "@/app/api/events/route";
import { GET as getReadinessScoresRoute } from "@/app/api/readiness-scores/route";
import { POST as postSimulationControlRoute } from "@/app/api/simulation/control/route";
import { GET as getSummariesRoute } from "@/app/api/summaries/route";
import { createSupabaseServiceRoleClient, type DatabaseClient } from "@/lib/db";

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
  const client = createSupabaseServiceRoleClient({
    key: SERVICE_ROLE_KEY,
    url: API_URL,
  });
  const scoreVersion = "api-validation-score-v1";
  const controlRequest = new Request("http://localhost:3000/api/simulation/control", {
    body: JSON.stringify({
      durationMinutes: 8,
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
  const controlResponse = await postSimulationControlRoute(controlRequest);

  if (controlResponse.status !== 201) {
    throw new Error(`Simulation control route returned ${controlResponse.status}.`);
  }

  const controlPayload = await parseJsonResponse(controlResponse);
  const ingestion = controlPayload.ingestion as { ingestionRunId: number } | undefined;

  if (!ingestion?.ingestionRunId) {
    throw new Error("Simulation control response did not include an ingestion run id.");
  }

  try {
    const crewResponse = await getCrewRoute();
    const crewPayload = await parseJsonResponse(crewResponse);
    const crews = crewPayload.crews as Array<{ crewCode: string }> | undefined;

    if (!crews || crews.length === 0) {
      throw new Error("Crew route did not return any crews.");
    }

    const crewCode = crews[0]?.crewCode ?? "CRW-001";
    const crewDetailResponse = await getCrewDetailRoute(
      new Request(`http://localhost:3000/api/crew/${crewCode}`),
      {
        params: Promise.resolve({ crewCode }),
      },
    );
    const crewDetailPayload = await parseJsonResponse(crewDetailResponse);

    if (!("crew" in crewDetailPayload)) {
      throw new Error("Crew detail route did not return a crew payload.");
    }

    const eventsResponse = await getEventsRoute(
      new Request("http://localhost:3000/api/events?limit=10"),
    );
    const eventsPayload = await parseJsonResponse(eventsResponse);

    if (!Array.isArray(eventsPayload.events)) {
      throw new Error("Events route did not return an events array.");
    }

    const readinessResponse = await getReadinessScoresRoute(
      new Request("http://localhost:3000/api/readiness-scores?limit=10"),
    );
    const readinessPayload = await parseJsonResponse(readinessResponse);

    if (!Array.isArray(readinessPayload.scores) || readinessPayload.scores.length === 0) {
      throw new Error("Readiness scores route did not return scores.");
    }

    const summariesResponse = await getSummariesRoute(
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
