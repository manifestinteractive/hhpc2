import { getEnvironmentSummary } from "../src/lib/health";

const summary = getEnvironmentSummary();

if (summary.missingRequiredKeys.length > 0) {
  console.error("Missing required environment keys:");
  for (const key of summary.missingRequiredKeys) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log("Environment contract satisfied.");
