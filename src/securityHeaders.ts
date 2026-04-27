/**
 * Security headers for HTTP responses.
 *
 * Provides convenience functions for applying a known-safe set of security
 * headers to a Headers object, with three presets reflecting common deployment
 * postures:
 *
 * - `strict`: maximum restriction, suitable for admin apps and authenticated
 *   surfaces. Frame-ancestors none, COOP/CORP same-origin, locked-down
 *   Permissions-Policy, base-uri/form-action self.
 * - `moderate`: relaxes CORP to same-site and X-Frame-Options to SAMEORIGIN
 *   for apps that embed within the same site or allow same-site framing.
 * - `permissive`: minimal headers (Referrer-Policy + X-Content-Type-Options).
 *   For public read-only surfaces where CSP would block legitimate behavior.
 *
 * `applyDefaultSecurityHeaders` is idempotent — it only sets headers that
 * are not already present, so consumers can override individual headers
 * upstream and still benefit from the rest of the preset.
 */

export type SecurityHeaderPreset = "strict" | "moderate" | "permissive";

export interface SecurityHeadersOptions {
  /** Which preset to start from. Defaults to "strict". */
  preset?: SecurityHeaderPreset;
  /**
   * Per-header overrides applied on top of the preset.
   * Pass a string to set a header value.
   * Pass `null` to remove a header that the preset would otherwise apply.
   */
  overrides?: Record<string, string | null>;
}

const STRICT_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Content-Security-Policy":
    "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

const MODERATE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  ...STRICT_HEADERS,
  "Cross-Origin-Resource-Policy": "same-site",
  "X-Frame-Options": "SAMEORIGIN",
});

const PERMISSIVE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
});

const PRESETS: Readonly<Record<SecurityHeaderPreset, Readonly<Record<string, string>>>> =
  Object.freeze({
    strict: STRICT_HEADERS,
    moderate: MODERATE_HEADERS,
    permissive: PERMISSIVE_HEADERS,
  });

/**
 * Get the resolved security header map for a preset, with overrides applied.
 *
 * Returns a fresh object each call — the caller is free to mutate it.
 */
export function getDefaultSecurityHeaders(
  options: SecurityHeadersOptions = {},
): Record<string, string> {
  const { preset = "strict", overrides = {} } = options;
  const resolved: Record<string, string> = { ...PRESETS[preset] };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete resolved[key];
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Apply security headers to a Headers object.
 *
 * Only sets headers that are not already present, so callers can override
 * individual headers upstream (e.g. setting CSP per-route) and the preset
 * fills in the rest.
 */
export function applyDefaultSecurityHeaders(
  headers: Headers,
  options: SecurityHeadersOptions = {},
): void {
  const resolved = getDefaultSecurityHeaders(options);
  for (const [key, value] of Object.entries(resolved)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
}
