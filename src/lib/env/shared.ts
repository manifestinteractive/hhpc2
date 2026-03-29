import type { EnvCheck, EnvScope } from "@/types/app";

export type EnvMap = Record<string, string | undefined>;

type EnvDefinition = {
  key: string;
  description: string;
  scope: EnvScope;
  required: boolean;
  defaultValue?: string;
};

export const envDefinitions: EnvDefinition[] = [
  {
    key: "NEXT_PUBLIC_APP_NAME",
    description: "Client-safe application name used in the bootstrap shell.",
    scope: "public",
    required: true,
    defaultValue: "HHPC2 Crew Readiness Platform",
  },
  {
    key: "NEXT_PUBLIC_APP_ENV",
    description: "Client-safe runtime label for UI and diagnostics.",
    scope: "public",
    required: true,
    defaultValue: "development",
  },
  {
    key: "NEXT_PUBLIC_FEATURE_AI_SUMMARIES",
    description:
      "Client-safe flag for exposing AI summary UI entry points later.",
    scope: "public",
    required: true,
    defaultValue: "false",
  },
  {
    key: "APP_URL",
    description:
      "Canonical application URL for local callbacks and hosted deployment.",
    scope: "server",
    required: true,
    defaultValue: "http://localhost:3000",
  },
  {
    key: "SUPABASE_URL",
    description: "Supabase project URL used for API and auth connectivity.",
    scope: "server",
    required: true,
  },
  {
    key: "SUPABASE_ANON_KEY",
    description: "Supabase anon key used for browser-safe auth and API access.",
    scope: "server",
    required: true,
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    description: "Server-only Supabase key for privileged operations.",
    scope: "server",
    required: false,
  },
  {
    key: "SUPABASE_PROJECT_ID",
    description: "Supabase project reference for linked type generation later.",
    scope: "server",
    required: false,
  },
  {
    key: "OPENAI_API_KEY",
    description: "Server-only OpenAI API key for future summary generation.",
    scope: "server",
    required: false,
  },
  {
    key: "OPENAI_MODEL_SUMMARY",
    description: "Default summary model used once AI features are enabled.",
    scope: "server",
    required: false,
    defaultValue: "gpt-5-mini",
  },
  {
    key: "AUTH_DEFAULT_ROLE",
    description: "Default development role to apply before auth UX exists.",
    scope: "server",
    required: false,
    defaultValue: "viewer",
  },
  {
    key: "FEATURE_ADMIN_TOOLS",
    description: "Server-side flag for admin views and actions.",
    scope: "server",
    required: false,
    defaultValue: "false",
  },
  {
    key: "FEATURE_SIMULATION_CONTROLS",
    description: "Server-side flag for later simulation controls.",
    scope: "server",
    required: false,
    defaultValue: "true",
  },
  {
    key: "SIM_DEFAULT_SEED",
    description: "Default seed for deterministic simulation playback.",
    scope: "server",
    required: false,
    defaultValue: "42",
  },
  {
    key: "SIM_DEFAULT_CADENCE_SECONDS",
    description: "Default cadence for simulation event generation.",
    scope: "server",
    required: false,
    defaultValue: "60",
  },
  {
    key: "SIM_DEFAULT_CREW_COUNT",
    description: "Default number of simulated crew members.",
    scope: "server",
    required: false,
    defaultValue: "4",
  },
];

function maskValue(value: string, scope: EnvScope) {
  if (!value) {
    return "missing";
  }

  if (scope === "public") {
    return value;
  }

  if (value.length <= 8) {
    return "configured";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function getEnvChecks(rawEnv: EnvMap = process.env): EnvCheck[] {
  return envDefinitions.map((definition) => {
    const envValue = rawEnv[definition.key]?.trim();
    const present = Boolean(envValue || definition.defaultValue);

    return {
      key: definition.key,
      description: definition.description,
      scope: definition.scope,
      required: definition.required,
      present,
      source: envValue
        ? "env"
        : definition.defaultValue
          ? "default"
          : "missing",
      value: maskValue(
        envValue ?? definition.defaultValue ?? "",
        definition.scope,
      ),
    };
  });
}
