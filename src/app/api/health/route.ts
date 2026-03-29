import { getEnvironmentSummary } from "@/lib/health";

export async function GET() {
  const environment = getEnvironmentSummary();

  return Response.json({
    status: environment.status,
    timestamp: new Date().toISOString(),
    service: "hhpc2",
    checks: {
      requiredEnv: environment.checks.filter((check) => check.required).length,
      missingRequiredEnv: environment.missingRequiredKeys,
      optionalConfigured: environment.configuredOptionalKeys,
    },
  });
}
