export type HealthStatus = "healthy" | "degraded" | "unconfigured";

export type EnvScope = "public" | "server";

export type EnvCheck = {
  key: string;
  description: string;
  scope: EnvScope;
  required: boolean;
  present: boolean;
  source: "env" | "default" | "missing";
  value: string;
};

export type EnvironmentSummary = {
  status: HealthStatus;
  checks: EnvCheck[];
  missingRequiredKeys: string[];
  invalidConfigurationKeys: string[];
  configuredOptionalKeys: string[];
};

export type DependencyReport = {
  name: string;
  status: HealthStatus;
  summary: string;
  details?: Record<string, string | number | boolean | null>;
};
