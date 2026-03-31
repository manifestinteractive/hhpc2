import { execFileSync } from "node:child_process";
import { createSupabaseServiceRoleClient, type DatabaseClient } from "@/lib/db";
import { ingestReadings, normalizeIngestionRun } from "@/lib/processing";
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

async function cleanup(
  client: DatabaseClient,
  ingestionRunId: number,
  normalizationVersion: string,
) {
  const { data: rawRows } = await client
    .from("raw_readings")
    .select("id")
    .eq("ingestion_run_id", ingestionRunId);
  const rawReadingIds = (rawRows ?? []).map((row) => row.id);

  if (rawReadingIds.length > 0) {
    await client
      .from("normalized_readings")
      .delete()
      .eq("normalization_version", normalizationVersion)
      .in("raw_reading_id", rawReadingIds);
  }

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
    seed: 91,
    startAt: new Date("2026-03-28T18:00:00.000Z").toISOString(),
  });
  const targetIndexes = simulationRun.readings
    .map((reading, index) => ({ index, reading }))
    .filter(
      ({ reading }) =>
        reading.crewCode === "CRW-001" && reading.signalType === "heart_rate",
    )
    .slice(1, 3)
    .map(({ index }) => index);
  const normalizedVersion = "validation-v1";
  const readings = simulationRun.readings.map((reading, index) => {
    if (index === targetIndexes[0]) {
      return {
        ...reading,
        status: "missing" as const,
        value: null,
      };
    }

    if (index === targetIndexes[1]) {
      return {
        ...reading,
        status: "dropout" as const,
        value: null,
      };
    }

    return reading;
  });
  const ingestion = await ingestReadings(client, {
    readings,
    runKind: "simulation",
    runMetadata: {
      validation: true,
    },
    sourceLabel: `validation-normalization-${Date.now()}`,
  });

  try {
    const modifiedSourceIdentifiers = targetIndexes
      .map((index) => {
        const reading = readings[index];

        if (!reading) {
          return null;
        }

        return `${reading.sourceKey}:${ingestion.ingestionRunId}:${index}:${reading.capturedAt}`;
      })
      .filter((value): value is string => Boolean(value));
    const normalized = await normalizeIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion: normalizedVersion,
    });

    if (normalized.normalizedRecordCount !== ingestion.acceptedRecordCount) {
      throw new Error(
        `Expected ${ingestion.acceptedRecordCount} normalized records, received ${normalized.normalizedRecordCount}.`,
      );
    }

    const { data: rawRows, error: rawRowsError } = await client
      .from("raw_readings")
      .select("id, source_identifier")
      .eq("ingestion_run_id", ingestion.ingestionRunId);

    if (rawRowsError) {
      throw new Error(`[raw_readings] select failed: ${rawRowsError.message}`);
    }

    const rawReadingIds = (rawRows ?? []).map((row) => row.id);

    const { count: normalizedCount, error: normalizedCountError } = await client
      .from("normalized_readings")
      .select("*", { count: "exact", head: true })
      .eq("normalization_version", normalizedVersion)
      .in("raw_reading_id", rawReadingIds);

    if (normalizedCountError) {
      throw new Error(
        `[normalized_readings] count failed: ${normalizedCountError.message}`,
      );
    }

    if (normalizedCount !== ingestion.acceptedRecordCount) {
      throw new Error(
        `Expected ${ingestion.acceptedRecordCount} persisted normalized records, received ${normalizedCount}.`,
      );
    }

    const specialRawIds = (rawRows ?? [])
      .filter((row) => modifiedSourceIdentifiers.includes(row.source_identifier))
      .map((row) => row.id);
    const { data: specialRows, error: specialRowsError } = await client
      .from("normalized_readings")
      .select("confidence_score, processing_metadata, raw_reading_id")
      .eq("normalization_version", normalizedVersion)
      .in("raw_reading_id", specialRawIds);

    if (specialRowsError) {
      throw new Error(
        `[normalized_readings] detail select failed: ${specialRowsError.message}`,
      );
    }

    if ((specialRows ?? []).length !== 2) {
      throw new Error("Expected normalized rows for the modified missing/dropout inputs.");
    }

    for (const row of specialRows ?? []) {
      const metadata =
        row.processing_metadata &&
        typeof row.processing_metadata === "object" &&
        !Array.isArray(row.processing_metadata)
          ? row.processing_metadata
          : {};
      const rawStatus = metadata.raw_status;

      if (rawStatus !== "missing" && rawStatus !== "dropout") {
        throw new Error("Expected normalized metadata to preserve raw status.");
      }

      if (row.confidence_score >= 0.8) {
        throw new Error("Expected imputed normalized rows to lower confidence.");
      }
    }

    const repeated = await normalizeIngestionRun(client, {
      ingestionRunId: ingestion.ingestionRunId,
      normalizationVersion: normalizedVersion,
    });

    if (repeated.normalizedRecordCount !== normalized.normalizedRecordCount) {
      throw new Error("Expected repeat normalization to remain idempotent.");
    }

    const { count: repeatedCount, error: repeatedCountError } = await client
      .from("normalized_readings")
      .select("*", { count: "exact", head: true })
      .eq("normalization_version", normalizedVersion)
      .in("raw_reading_id", rawReadingIds);

    if (repeatedCountError) {
      throw new Error(
        `[normalized_readings] repeated count failed: ${repeatedCountError.message}`,
      );
    }

    if (repeatedCount !== normalizedCount) {
      throw new Error("Repeat normalization created duplicate rows.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          ...normalized,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup(client, ingestion.ingestionRunId, normalizedVersion);
  }
}

void main();
