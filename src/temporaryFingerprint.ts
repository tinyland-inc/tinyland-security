/**
 * Temporary Fingerprint Generation
 *
 * Generates a server-side temporary fingerprint for first-time visitors
 * before full FingerprintJS client-side fingerprint is available.
 *
 * Algorithm:
 * - SHA-256 hash of: IP + User-Agent + Accept-Language + Hour bucket
 * - Prefixed with "temp_" for identification
 * - Short-lived (1 hour max-age) until upgraded
 *
 * @module temporaryFingerprint
 */

import { createHash } from 'crypto';

export interface TempFingerprintInputs {
	ip: string;
	userAgent: string;
	acceptLanguage?: string | null;
	timestamp?: number;
}

/**
 * Generate a temporary server-side fingerprint
 *
 * @param inputs - Server-side data available for fingerprinting
 * @returns Temporary fingerprint prefixed with "temp_"
 */
export function generateTempFingerprint(inputs: TempFingerprintInputs): string {
	const {
		ip,
		userAgent,
		acceptLanguage = 'unknown',
		timestamp = Date.now()
	} = inputs;

	const hourBucket = Math.floor(timestamp / (60 * 60 * 1000));

	const fingerprintData = [
		ip,
		userAgent,
		acceptLanguage || 'unknown',
		hourBucket.toString()
	].join('|');

	const hash = createHash('sha256')
		.update(fingerprintData)
		.digest('hex')
		.slice(0, 32);

	return `temp_${hash}`;
}

/**
 * Check if a fingerprint is temporary (server-generated)
 */
export function isTempFingerprint(fingerprintId: string | null | undefined): boolean {
	return !!fingerprintId && fingerprintId.startsWith('temp_');
}

/**
 * Extract hash from temporary fingerprint
 */
export function getTempFingerprintHash(tempFingerprintId: string): string | null {
	if (!isTempFingerprint(tempFingerprintId)) {
		return null;
	}
	return tempFingerprintId.slice(5);
}

/**
 * Validate temporary fingerprint format
 */
export function isValidTempFingerprint(fingerprintId: string): boolean {
	const regex = /^temp_[0-9a-f]{32}$/i;
	return regex.test(fingerprintId);
}
