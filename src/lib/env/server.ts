import { z } from "zod";
import type { EnvMap } from "@/lib/env/shared";

const serverEnvSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_PROJECT_ID: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL_SUMMARY: z.string().min(1).default("gpt-5-mini"),
  AUTH_DEFAULT_ROLE: z.enum(["admin", "analyst", "viewer"]).default("viewer"),
  FEATURE_ADMIN_TOOLS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  FEATURE_SIMULATION_CONTROLS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SIM_DEFAULT_SEED: z.coerce.number().int().default(42),
  SIM_DEFAULT_CADENCE_SECONDS: z.coerce.number().int().positive().default(60),
  SIM_DEFAULT_CREW_COUNT: z.coerce.number().int().positive().default(4),
});

export function getServerEnv(rawEnv: EnvMap = process.env) {
  return serverEnvSchema.parse(rawEnv);
}
