import { describe, expect, it } from "vitest";
import {
  determineIngestionRunStatus,
  parseSimulationIngestionRequest,
  resolveSimulationCrewProfiles,
} from "@/lib/processing/ingestion";

describe("determineIngestionRunStatus", () => {
  it("returns completed when all records are accepted", () => {
    expect(determineIngestionRunStatus(4, 4, 0)).toBe("completed");
  });

  it("returns partially completed when some records are rejected", () => {
    expect(determineIngestionRunStatus(4, 3, 1)).toBe("partially_completed");
  });

  it("returns failed when no records are accepted", () => {
    expect(determineIngestionRunStatus(4, 0, 4)).toBe("failed");
  });
});

describe("resolveSimulationCrewProfiles", () => {
  it("returns the requested subset when crew codes are provided", () => {
    const profiles = resolveSimulationCrewProfiles(["CRW-001", "CRW-003"]);

    expect(profiles?.map((profile) => profile.crewCode)).toEqual([
      "CRW-001",
      "CRW-003",
    ]);
  });

  it("throws when an unknown crew code is requested", () => {
    expect(() => resolveSimulationCrewProfiles(["CRW-999"])).toThrow(
      "Unknown simulation crew codes: CRW-999.",
    );
  });
});

describe("parseSimulationIngestionRequest", () => {
  it("accepts an empty body and provides defaults", () => {
    const parsed = parseSimulationIngestionRequest({});

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.sourceLabel).toBe("simulation-api");
    }
  });

  it("rejects impossible simulation settings", () => {
    const parsed = parseSimulationIngestionRequest({
      scenarios: [
        {
          kind: "acute_stress",
          signalTypes: ["heart_rate"],
        },
      ],
      timestampJitterSeconds: -1,
    });

    expect(parsed.success).toBe(false);
  });
});
