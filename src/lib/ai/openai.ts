import OpenAI from "openai";
import { buildSummaryInput, buildSummaryInstructions } from "@/lib/ai/prompts";
import type {
  CrewSummaryInputContext,
  GeneratedSummaryResult,
  SummaryGenerationOptions,
  SummaryProvider,
} from "@/lib/ai/types";

function extractSummaryText(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as { summaryText?: unknown };

    if (typeof parsed.summaryText === "string") {
      return parsed.summaryText.trim();
    }
  } catch {
    // Fall back to raw text when the model returns plain text.
  }

  return trimmed;
}

export function createOpenAISummaryProvider(options: {
  apiKey: string;
  model: string;
}): SummaryProvider {
  const client = new OpenAI({
    apiKey: options.apiKey,
  });

  return {
    async generateSummary(
      input: CrewSummaryInputContext,
      generationOptions: SummaryGenerationOptions = {},
    ): Promise<GeneratedSummaryResult> {
      const response = await client.responses.create({
        model: options.model,
        instructions: buildSummaryInstructions(input, generationOptions),
        input: buildSummaryInput(input),
        max_output_tokens: 800,
        reasoning: {
          effort: "minimal",
        },
        text: {
          verbosity: "low",
        },
      });

      const summaryText = extractSummaryText(response.output_text);

      if (!summaryText) {
        throw new Error("OpenAI summary generation returned no usable text.");
      }

      return {
        modelName: options.model,
        providerName: "openai",
        summaryText,
      };
    },
  };
}
