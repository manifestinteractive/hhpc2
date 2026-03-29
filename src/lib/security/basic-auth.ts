import { z } from "zod";

type BasicAuthConfig = {
  password: string | null;
  username: string | null;
};

const basicAuthEnvSchema = z
  .object({
    DEMO_BASIC_AUTH_PASSWORD: z.string().trim().min(1).optional(),
    DEMO_BASIC_AUTH_USERNAME: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
    const hasPassword = Boolean(value.DEMO_BASIC_AUTH_PASSWORD);
    const hasUsername = Boolean(value.DEMO_BASIC_AUTH_USERNAME);

    if (hasPassword !== hasUsername) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "DEMO_BASIC_AUTH_USERNAME and DEMO_BASIC_AUTH_PASSWORD must both be set or both be omitted.",
      });
    }
  });

export function getBasicAuthConfig(
  rawEnv: Record<string, string | undefined> = process.env,
): BasicAuthConfig {
  const parsed = basicAuthEnvSchema.parse(rawEnv);

  return {
    password: parsed.DEMO_BASIC_AUTH_PASSWORD ?? null,
    username: parsed.DEMO_BASIC_AUTH_USERNAME ?? null,
  };
}

export function isBasicAuthEnabled(
  rawEnv: Record<string, string | undefined> = process.env,
) {
  const config = getBasicAuthConfig(rawEnv);
  return Boolean(config.username && config.password);
}

export function decodeBasicAuthHeader(headerValue: string | null) {
  if (!headerValue?.startsWith("Basic ")) {
    return null;
  }

  const encoded = headerValue.slice("Basic ".length).trim();

  if (!encoded) {
    return null;
  }

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      password: decoded.slice(separatorIndex + 1),
      username: decoded.slice(0, separatorIndex),
    };
  } catch {
    return null;
  }
}

export function isAuthorizedBasicAuthHeader(
  headerValue: string | null,
  rawEnv: Record<string, string | undefined> = process.env,
) {
  const config = getBasicAuthConfig(rawEnv);

  if (!config.username || !config.password) {
    return true;
  }

  const decoded = decodeBasicAuthHeader(headerValue);

  if (!decoded) {
    return false;
  }

  return (
    decoded.username === config.username && decoded.password === config.password
  );
}
