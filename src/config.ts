/**
 * Global configuration for @tinyland-inc/tinyland-security
 *
 * Provides a singleton configuration store that replaces
 * SvelteKit's $env/dynamic/private and $lib/server/logger imports.
 *
 * Usage:
 * ```typescript
 * import { configureSecurity } from '@tinyland-inc/tinyland-security';
 *
 * configureSecurity({
 *   config: {
 *     ipEncryptionKey: process.env.IP_ENCRYPTION_KEY,
 *     ipHashSalt: process.env.IP_HASH_SALT,
 *     nodeEnv: process.env.NODE_ENV,
 *   },
 *   logger: myLogger,
 * });
 * ```
 *
 * @module config
 */

import type { SecurityConfig, SecurityLogger } from './types.js';

// ============================================================================
// Default console logger (fallback when no logger is configured)
// ============================================================================

const consoleLogger: SecurityLogger = {
	info(message: string, data?: Record<string, unknown>) {
		console.log(`[security:info] ${message}`, data ?? '');
	},
	warn(message: string, data?: Record<string, unknown>) {
		console.warn(`[security:warn] ${message}`, data ?? '');
	},
	error(message: string, data?: Record<string, unknown>) {
		console.error(`[security:error] ${message}`, data ?? '');
	},
	debug(message: string, data?: Record<string, unknown>) {
		if (process.env.NODE_ENV === 'development') {
			console.debug(`[security:debug] ${message}`, data ?? '');
		}
	},
};

// ============================================================================
// Global state
// ============================================================================

let _config: SecurityConfig = {};
let _logger: SecurityLogger = consoleLogger;

// ============================================================================
// Public API
// ============================================================================

/**
 * Configure the security package with secrets and a logger.
 * Call this once during application startup before using any security functions.
 */
export function configureSecurity(options: {
	config?: SecurityConfig;
	logger?: SecurityLogger;
}): void {
	if (options.config) {
		_config = { ..._config, ...options.config };
	}
	if (options.logger) {
		_logger = options.logger;
	}
}

/**
 * Get the current security configuration.
 * @internal Used by security modules to read injected config.
 */
export function getSecurityConfig(): SecurityConfig {
	return _config;
}

/**
 * Get the current logger instance.
 * @internal Used by security modules for structured logging.
 */
export function getLogger(): SecurityLogger {
	return _logger;
}

/**
 * Reset configuration to defaults (for testing).
 * @internal
 */
export function resetSecurityConfig(): void {
	_config = {};
	_logger = consoleLogger;
}
