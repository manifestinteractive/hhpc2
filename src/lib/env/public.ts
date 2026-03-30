import { z } from "zod";
import type { EnvMap } from "@/lib/env/shared";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z
    .string()
    .min(1)
    .default("Crew Readiness"),
  NEXT_PUBLIC_APP_ENV: z.string().min(1).default("development"),
});

export function getPublicEnv(rawEnv: EnvMap = process.env) {
  return publicEnvSchema.parse(rawEnv);
}
