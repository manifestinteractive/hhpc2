import { describe, expect, it } from "vitest";
import {
  decodeBasicAuthHeader,
  getBasicAuthConfig,
  isAuthorizedBasicAuthHeader,
  isBasicAuthEnabled,
} from "@/lib/security/basic-auth";

describe("basic auth helpers", () => {
  it("treats missing credentials as disabled", () => {
    expect(isBasicAuthEnabled({})).toBe(false);
  });

  it("rejects partial basic auth configuration", () => {
    expect(() =>
      getBasicAuthConfig({
        DEMO_BASIC_AUTH_USERNAME: "demo",
      }),
    ).toThrow();
  });

  it("decodes and validates a matching authorization header", () => {
    const headerValue = `Basic ${Buffer.from("demo:secret").toString("base64")}`;

    expect(decodeBasicAuthHeader(headerValue)).toEqual({
      password: "secret",
      username: "demo",
    });
    expect(
      isAuthorizedBasicAuthHeader(headerValue, {
        DEMO_BASIC_AUTH_PASSWORD: "secret",
        DEMO_BASIC_AUTH_USERNAME: "demo",
      }),
    ).toBe(true);
  });

  it("rejects mismatched credentials", () => {
    const headerValue = `Basic ${Buffer.from("demo:nope").toString("base64")}`;

    expect(
      isAuthorizedBasicAuthHeader(headerValue, {
        DEMO_BASIC_AUTH_PASSWORD: "secret",
        DEMO_BASIC_AUTH_USERNAME: "demo",
      }),
    ).toBe(false);
  });
});
