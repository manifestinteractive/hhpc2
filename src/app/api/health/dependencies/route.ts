import { getDependencyReports, getEnvironmentSummary } from "@/lib/health";

export async function GET() {
  const environment = getEnvironmentSummary();
  const dependencies = await getDependencyReports();

  return Response.json({
    status: dependencies.every((dependency) => dependency.status === "healthy")
      ? "healthy"
      : "degraded",
    timestamp: new Date().toISOString(),
    environment,
    dependencies,
  });
}
