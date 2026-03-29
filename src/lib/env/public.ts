import { z } from "zod";
import type { EnvMap } from "@/lib/env/shared";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z
    .string()
    .min(1)
    .default("HHPC2 Crew Readiness Platform"),
  NEXT_PUBLIC_APP_ENV: z.string().min(1).default("development"),
  NEXT_PUBLIC_FEATURE_AI_SUMMARIES: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export function getPublicEnv(rawEnv: EnvMap = process.env) {
  return publicEnvSchema.parse(rawEnv);
}
