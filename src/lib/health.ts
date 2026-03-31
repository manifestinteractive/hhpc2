import { getEnvChecks, type EnvMap } from "@/lib/env/shared";
import { getServerEnv } from "@/lib/env/server";
import type {
  DependencyReport,
  EnvironmentSummary,
  HealthStatus,
} from "@/types/app";

const HOSTED_APP_ENVS = new Set(["preview", "production"]);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function deriveStatus(
  missingRequiredKeys: string[],
  invalidConfigurationKeys: string[],
): HealthStatus {
  return missingRequiredKeys.length === 0 && invalidConfigurationKeys.length === 0
    ? "healthy"
    : "degraded";
}

function isHostedRuntime(rawEnv: EnvMap) {
  const vercelEnv = rawEnv.VERCEL_ENV?.trim() ?? "";
  const appEnv = rawEnv.NEXT_PUBLIC_APP_ENV?.trim() ?? "";

  return HOSTED_APP_ENVS.has(vercelEnv) || HOSTED_APP_ENVS.has(appEnv);
}

function isLocalAppUrl(value: string) {
  try {
    const url = new URL(value);
    return LOCAL_HOSTNAMES.has(url.hostname);
  } catch {
    return true;
  }
}

function getInvalidConfigurationKeys(rawEnv: EnvMap) {
  if (!isHostedRuntime(rawEnv)) {
    return [];
  }

  const invalidKeys: string[] = [];
  const appEnv = rawEnv.NEXT_PUBLIC_APP_ENV?.trim() ?? "";
  const appUrl = rawEnv.APP_URL?.trim() ?? "";

  if (!HOSTED_APP_ENVS.has(appEnv)) {
    invalidKeys.push("NEXT_PUBLIC_APP_ENV");
  }

  if (!appUrl || isLocalAppUrl(appUrl)) {
    invalidKeys.push("APP_URL");
  }

  return invalidKeys;
}

export function getEnvironmentSummary(
  rawEnv: EnvMap = process.env,
): EnvironmentSummary {
  const checks = getEnvChecks(rawEnv);
  const missingRequiredKeys = checks
    .filter((check) => check.required && !check.present)
    .map((check) => check.key);
  const invalidConfigurationKeys = getInvalidConfigurationKeys(rawEnv);

  return {
    status: deriveStatus(missingRequiredKeys, invalidConfigurationKeys),
    checks,
    missingRequiredKeys,
    invalidConfigurationKeys,
    configuredOptionalKeys: checks
      .filter((check) => !check.required && check.source !== "missing")
      .map((check) => check.key),
  };
}

async function getSupabaseDependency(
  rawEnv: EnvMap,
): Promise<DependencyReport> {
  const env = getServerEnv(rawEnv);

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return {
      name: "supabase",
      status: "unconfigured",
      summary:
        "SUPABASE_URL and SUPABASE_ANON_KEY are required before local dependency checks can pass.",
    };
  }

  try {
    const response = await fetch(new URL("/rest/v1/", env.SUPABASE_URL), {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
    });

    return {
      name: "supabase",
      status: response.ok ? "healthy" : "degraded",
      summary: response.ok
        ? "Supabase responded successfully."
        : "Supabase responded, but the REST endpoint did not return a success status.",
      details: {
        statusCode: response.status,
        statusText: response.statusText || null,
      },
    };
  } catch (error) {
    return {
      name: "supabase",
      status: "degraded",
      summary:
        "Supabase is configured, but the project could not be reached from the app runtime.",
      details: {
        message:
          error instanceof Error ? error.message : "Unknown connectivity error",
      },
    };
  }
}

export async function getDependencyReports(
  rawEnv: EnvMap = process.env,
): Promise<DependencyReport[]> {
  const environment = getEnvironmentSummary(rawEnv);
  const appReport: DependencyReport = {
    name: "application",
    status: environment.status,
    summary:
      environment.status === "healthy"
        ? "Bootstrap environment contract is satisfied."
        : "One or more required or hosted-runtime environment settings are invalid.",
    details: {
      invalidConfigurationKeyCount: environment.invalidConfigurationKeys.length,
      missingRequiredKeyCount: environment.missingRequiredKeys.length,
    },
  };

  return [appReport, await getSupabaseDependency(rawEnv)];
}
