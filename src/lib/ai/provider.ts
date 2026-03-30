import { getServerEnv } from "@/lib/env/server";
import { createOpenAISummaryProvider } from "@/lib/ai/openai";
import type { SummaryProvider } from "@/lib/ai/types";

export type {
  CrewSummaryInputContext,
  GeneratedSummaryResult,
  SummaryProvider,
  SummaryScopeInput,
} from "@/lib/ai/types";

export function getSummaryProvider(): SummaryProvider {
  const env = getServerEnv();

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate AI summaries.");
  }

  return createOpenAISummaryProvider({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL_SUMMARY,
  });
}
