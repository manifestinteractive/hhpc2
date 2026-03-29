import { execFileSync } from "node:child_process";
import { createSupabaseServiceRoleClient, type DatabaseClient } from "@/lib/db";
import { ingestReadings } from "@/lib/processing";
import { generateSimulationRun } from "@/lib/simulation";

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

async function cleanup(client: DatabaseClient, ingestionRunId: number) {
  await client
    .from("system_logs")
    .delete()
    .eq("related_table_name", "ingestion_runs")
    .eq("related_record_id", ingestionRunId);

  await client.from("raw_readings").delete().eq("ingestion_run_id", ingestionRunId);

  await client.from("ingestion_runs").delete().eq("id", ingestionRunId);
}

async function main() {
  const { API_URL, SERVICE_ROLE_KEY } = getLocalSupabaseStatus();
  const client = createSupabaseServiceRoleClient({
    key: SERVICE_ROLE_KEY,
    url: API_URL,
  });
  const simulationRun = generateSimulationRun({
    cadenceSeconds: 60,
    durationMinutes: 10,
    seed: 77,
    startAt: new Date("2026-03-28T18:00:00.000Z").toISOString(),
  });
  const invalidReading = {
    ...simulationRun.readings[0],
    crewCode: "CRW-999",
  };
  const result = await ingestReadings(client, {
    readings: [...simulationRun.readings, invalidReading],
    runKind: "simulation",
    runMetadata: {
      validation: true,
    },
    sourceLabel: `validation-ingestion-${Date.now()}`,
  });

  try {
    if (result.status !== "partially_completed") {
      throw new Error(
        `Expected ingestion status to be partially_completed, received ${result.status}.`,
      );
    }

    if (result.acceptedRecordCount !== simulationRun.readings.length) {
      throw new Error(
        `Expected ${simulationRun.readings.length} accepted records, received ${result.acceptedRecordCount}.`,
      );
    }

    if (result.rejectedRecordCount !== 1) {
      throw new Error(
        `Expected 1 rejected record, received ${result.rejectedRecordCount}.`,
      );
    }

    const { count: persistedCount, error: persistedCountError } = await client
      .from("raw_readings")
      .select("*", { count: "exact", head: true })
      .eq("ingestion_run_id", result.ingestionRunId);

    if (persistedCountError) {
      throw new Error(
        `[raw_readings] count failed: ${persistedCountError.message}`,
      );
    }

    if (persistedCount !== simulationRun.readings.length) {
      throw new Error(
        `Expected ${simulationRun.readings.length} raw readings, received ${persistedCount}.`,
      );
    }

    const { count: logCount, error: logCountError } = await client
      .from("system_logs")
      .select("*", { count: "exact", head: true })
      .eq("related_table_name", "ingestion_runs")
      .eq("related_record_id", result.ingestionRunId);

    if (logCountError) {
      throw new Error(`[system_logs] count failed: ${logCountError.message}`);
    }

    if (!logCount || logCount < 2) {
      throw new Error("Expected ingestion start and completion logs to exist.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup(client, result.ingestionRunId);
  }
}

void main();
