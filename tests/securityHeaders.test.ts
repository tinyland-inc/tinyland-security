import { describe, expect, it } from "vitest";
import {
  applyDefaultSecurityHeaders,
  getDefaultSecurityHeaders,
} from "../src/securityHeaders.js";

describe("getDefaultSecurityHeaders", () => {
  it("returns the strict preset by default", () => {
    const headers = getDefaultSecurityHeaders();
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });

  it("relaxes X-Frame-Options and CORP for moderate", () => {
    const headers = getDefaultSecurityHeaders({ preset: "moderate" });
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-site");
    expect(headers["Content-Security-Policy"]).toBeDefined();
  });

  it("emits only minimal headers for permissive", () => {
    const headers = getDefaultSecurityHeaders({ preset: "permissive" });
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toBeUndefined();
    expect(headers["X-Frame-Options"]).toBeUndefined();
  });

  it("applies string overrides on top of preset", () => {
    const headers = getDefaultSecurityHeaders({
      preset: "strict",
      overrides: { "X-Frame-Options": "SAMEORIGIN" },
    });
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });

  it("removes headers when override is null", () => {
    const headers = getDefaultSecurityHeaders({
      preset: "strict",
      overrides: { "Content-Security-Policy": null },
    });
    expect(headers["Content-Security-Policy"]).toBeUndefined();
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("returns a fresh object each call", () => {
    const a = getDefaultSecurityHeaders();
    const b = getDefaultSecurityHeaders();
    a["Custom"] = "x";
    expect(b["Custom"]).toBeUndefined();
  });
});

describe("applyDefaultSecurityHeaders", () => {
  it("sets all preset headers on an empty Headers object", () => {
    const headers = new Headers();
    applyDefaultSecurityHeaders(headers);
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("does not overwrite existing headers", () => {
    const headers = new Headers();
    headers.set("X-Frame-Options", "SAMEORIGIN");
    applyDefaultSecurityHeaders(headers);
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("respects preset choice", () => {
    const headers = new Headers();
    applyDefaultSecurityHeaders(headers, { preset: "moderate" });
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("respects overrides", () => {
    const headers = new Headers();
    applyDefaultSecurityHeaders(headers, {
      preset: "strict",
      overrides: { "X-Custom": "tinyland" },
    });
    expect(headers.get("X-Custom")).toBe("tinyland");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("removes preset headers when override is null", () => {
    const headers = new Headers();
    applyDefaultSecurityHeaders(headers, {
      overrides: { "Content-Security-Policy": null },
    });
    expect(headers.has("Content-Security-Policy")).toBe(false);
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });
});
