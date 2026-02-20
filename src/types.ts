/**
 * Shared type definitions for @tummycrypt/tinyland-security
 *
 * These types decouple the security package from SvelteKit-specific
 * concerns and provide config injection for secrets.
 *
 * @module types
 */

// ============================================================================
// Configuration (replaces $env/dynamic/private and $env/static/private)
// ============================================================================

/**
 * Security configuration for environment-specific secrets.
 * All secrets are injected via this config object rather than
 * imported from SvelteKit $env modules.
 */
export interface SecurityConfig {
	/** AES-256 encryption key for reversible IP storage (64 hex chars) */
	ipEncryptionKey?: string;
	/** HMAC-SHA256 salt for one-way IP hashing */
	ipHashSalt?: string;
	/** Salt for fingerprint hashing */
	fingerprintSalt?: string;
	/** NODE_ENV equivalent for environment detection */
	nodeEnv?: string;
	/** Whether rate limiting is bypassed (testing) */
	rateLimitBypass?: boolean;
}

// ============================================================================
// Logger interface (replaces $lib/server/logger imports)
// ============================================================================

/**
 * Minimal logger interface for dependency injection.
 * Compatible with any structured logger (pino, winston, console, etc.)
 */
export interface SecurityLogger {
	info(message: string, data?: Record<string, unknown>): void;
	warn(message: string, data?: Record<string, unknown>): void;
	error(message: string, data?: Record<string, unknown>): void;
	debug(message: string, data?: Record<string, unknown>): void;
	child?(meta: Record<string, unknown>): SecurityLogger;
}

// ============================================================================
// Generic request interface (replaces SvelteKit RequestEvent)
// ============================================================================

/**
 * Generic HTTP request representation.
 * Replaces SvelteKit's RequestEvent for framework-agnostic usage.
 */
export interface SecurityRequest {
	headers: Headers;
	url: string;
}

// ============================================================================
// Device type (framework-agnostic version)
// ============================================================================

/**
 * Device type classification from user agent analysis.
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

// ============================================================================
// Re-exports of result types from submodules
// ============================================================================

export type { RiskScore, RiskFactor } from './riskScoring.js';
export type { VPNDetectionResult } from './vpnDetection.js';
export type { GeoLocation, ASNResult } from './geolocation.js';
export type { BrowserInfo } from './userAgentParser.js';
export type { AnomalyResult } from './loginAnomaly.js';
export type { RateLimitConfig, RateLimitResult, RateLimitStats, RateLimitEntry } from './rateLimit.js';
export type { TempFingerprintInputs } from './temporaryFingerprint.js';
