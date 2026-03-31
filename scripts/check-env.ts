import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getEnvironmentSummary } from "../src/lib/health";
import { getBasicAuthConfig } from "../src/lib/security/basic-auth";

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadLocalEnvFiles() {
  const files = [".env.local", ".env"];

  for (const filename of files) {
    const filepath = resolve(process.cwd(), filename);

    if (!existsSync(filepath)) {
      continue;
    }

    const contents = readFileSync(filepath, "utf8");

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();

      if (!key || process.env[key] !== undefined) {
        continue;
      }

      const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
      process.env[key] = value;
    }
  }
}

loadLocalEnvFiles();

const summary = getEnvironmentSummary();
getBasicAuthConfig();

if (summary.missingRequiredKeys.length > 0) {
  console.error("Missing required environment keys:");
  for (const key of summary.missingRequiredKeys) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

if (summary.invalidConfigurationKeys.length > 0) {
  console.error("Invalid hosted environment settings:");
  for (const key of summary.invalidConfigurationKeys) {
    console.error(`- ${key}`);
  }
  console.error(
    "Set NEXT_PUBLIC_APP_ENV to preview or production and APP_URL to the deployed demo URL for hosted environments.",
  );
  process.exit(1);
}

console.log("Environment contract satisfied.");
