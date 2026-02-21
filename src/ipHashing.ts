/**
 * IP Address Hashing Utilities
 *
 * Provides GDPR-compliant IP hashing for privacy-safe logging and session tracking.
 *
 * Uses HMAC-SHA256 with secret salt for one-way, deterministic hashing.
 * Salt is injected via SecurityConfig (not imported from $env).
 *
 * @module ipHashing
 */

import * as crypto from 'crypto';
import { getSecurityConfig } from './config.js';
import { getLogger } from './config.js';

/**
 * Hash an IP address using HMAC-SHA256
 *
 * Returns a deterministic 16-character hash that:
 * - Cannot be reversed to get original IP
 * - Always produces same hash for same IP
 * - Changes completely if IP changes by even 1 bit
 *
 * @param ip - IPv4 or IPv6 address to hash
 * @returns 16-character hexadecimal hash
 */
export function hashIp(ip: string): string {
	const logger = getLogger();

	if (!ip || typeof ip !== 'string') {
		logger.warn('Invalid IP address provided to hashIp', { ip: ip as unknown as string });
		ip = '0.0.0.0';
	}

	const config = getSecurityConfig();
	const salt = config.ipHashSalt || 'development-salt-change-in-production-immediately';

	if (salt === 'development-salt-change-in-production-immediately' && config.nodeEnv === 'production') {
		logger.error('Using development IP_HASH_SALT in production!', {
			level: 'SECURITY',
			message: 'Set IP_HASH_SALT environment variable immediately'
		});
	}

	return crypto
		.createHmac('sha256', salt)
		.update(ip)
		.digest('hex')
		.substring(0, 16);
}

/**
 * Mask an IP address for display purposes
 *
 * @param ip - IPv4 or IPv6 address to mask
 * @returns Masked IP address
 */
export function maskIp(ip: string): string {
	const parts = ip.split('.');
	if (parts.length === 4) {
		return `${parts[0]}.${parts[1]}.*.*`;
	}
	return ip;
}

/**
 * Validate that an IP hash matches the expected format
 *
 * @param hash - Hash to validate
 * @returns true if hash is valid (16 hex chars)
 */
export function isValidIpHash(hash: string): boolean {
	return /^[a-f0-9]{16}$/.test(hash);
}

/**
 * Generate a secure salt for IP hashing
 *
 * @returns 64-character hexadecimal salt
 */
export function generateSalt(): string {
	return crypto.randomBytes(32).toString('hex');
}
