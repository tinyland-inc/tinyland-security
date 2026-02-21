/**
 * Browser Fingerprint Hashing Utility
 *
 * Provides secure hashing for browser fingerprints using SHA-256.
 * Follows same pattern as IP hashing for consistency.
 *
 * @module fingerprintHashing
 */

import { createHash } from 'crypto';
import { getSecurityConfig } from './config.js';

/**
 * Hash browser fingerprint for secure storage
 *
 * Uses SHA-256 with environment-specific salt to create
 * deterministic but irreversible fingerprint hashes.
 *
 * @param fingerprint - Raw browser fingerprint ID from FingerprintJS
 * @returns Hex-encoded SHA-256 hash
 */
export async function hashFingerprint(fingerprint: string): Promise<string> {
	const config = getSecurityConfig();
	const salt = config.fingerprintSalt || config.ipHashSalt || 'dev-salt-change-in-production';

	const hash = createHash('sha256');
	hash.update(fingerprint + salt);

	return hash.digest('hex');
}

/**
 * Verify fingerprint matches hash
 *
 * @param fingerprint - Raw fingerprint to verify
 * @param hash - Expected hash value
 * @returns True if fingerprint matches hash
 */
export async function verifyFingerprint(fingerprint: string, hash: string): Promise<boolean> {
	const computedHash = await hashFingerprint(fingerprint);
	return computedHash === hash;
}
