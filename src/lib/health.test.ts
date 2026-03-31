import { describe, expect, it } from "vitest";
import { getEnvironmentSummary } from "@/lib/health";

describe("getEnvironmentSummary", () => {
  it("marks missing required service keys as degraded", () => {
    const summary = getEnvironmentSummary({
      NEXT_PUBLIC_APP_NAME: "HHPC2",
      NEXT_PUBLIC_APP_ENV: "development",
      APP_URL: "http://localhost:3000",
    });

    expect(summary.status).toBe("degraded");
    expect(summary.missingRequiredKeys).toEqual([
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
  });

  it("reports healthy when required keys are present", () => {
    const summary = getEnvironmentSummary({
      NEXT_PUBLIC_APP_NAME: "HHPC2",
      NEXT_PUBLIC_APP_ENV: "development",
      APP_URL: "http://localhost:3000",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    expect(summary.status).toBe("healthy");
    expect(summary.missingRequiredKeys).toEqual([]);
    expect(summary.invalidConfigurationKeys).toEqual([]);
  });

  it("marks hosted envs with localhost defaults as degraded", () => {
    const summary = getEnvironmentSummary({
      NEXT_PUBLIC_APP_NAME: "HHPC2",
      NEXT_PUBLIC_APP_ENV: "development",
      APP_URL: "http://localhost:3000",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      VERCEL_ENV: "production",
    });

    expect(summary.status).toBe("degraded");
    expect(summary.invalidConfigurationKeys).toEqual([
      "NEXT_PUBLIC_APP_ENV",
      "APP_URL",
    ]);
  });
});
