/**
 * IP Address Encryption Utilities
 *
 * Provides AES-256-GCM encryption for reversible IP storage with audit logging.
 *
 * Security:
 * - Uses AES-256-GCM (authenticated encryption)
 * - Random 96-bit IV per encryption (prevents pattern detection)
 * - Authentication tag prevents tampering
 * - Key injected via SecurityConfig (not from $env)
 * - Decryption events logged to audit trail
 *
 * Format: `iv:authTag:encrypted` (all hex-encoded)
 *
 * @module ipEncryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getSecurityConfig, getLogger } from './config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from config
 * Validates key length and format
 *
 * @throws Error if key is missing or invalid
 */
function getEncryptionKey(): Buffer {
	const config = getSecurityConfig();
	const keyHex = config.ipEncryptionKey;

	if (!keyHex) {
		throw new Error(
			'IP_ENCRYPTION_KEY not configured. Call configureSecurity() with ipEncryptionKey, or generate with: openssl rand -hex 32'
		);
	}

	if (!/^[a-f0-9]{64}$/i.test(keyHex)) {
		throw new Error(
			`ipEncryptionKey must be 64 hex characters (32 bytes). Got: ${keyHex.length} chars`
		);
	}

	const key = Buffer.from(keyHex, 'hex');

	if (key.length !== KEY_LENGTH) {
		throw new Error(
			`ipEncryptionKey must be ${KEY_LENGTH} bytes. Got: ${key.length} bytes`
		);
	}

	return key;
}

/**
 * Encrypt an IP address using AES-256-GCM
 *
 * Returns format: `iv:authTag:encrypted` (hex-encoded)
 *
 * @param ip - IPv4 or IPv6 address to encrypt
 * @returns Encrypted string in format "iv:authTag:encrypted"
 */
export function encryptIP(ip: string): string {
	const logger = getLogger();

	if (!ip || typeof ip !== 'string') {
		logger.warn('Invalid IP address provided to encryptIP', { ip });
		ip = '0.0.0.0';
	}

	try {
		const key = getEncryptionKey();
		const iv = randomBytes(IV_LENGTH);

		const cipher = createCipheriv(ALGORITHM, key, iv);

		let encrypted = cipher.update(ip, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		const authTag = cipher.getAuthTag().toString('hex');

		return `${iv.toString('hex')}:${authTag}:${encrypted}`;
	} catch (error) {
		logger.error('IP encryption failed', {
			error: error instanceof Error ? error.message : 'Unknown error',
			ipLength: ip.length
		});
		throw new Error('IP encryption failed');
	}
}

/**
 * Decrypt an encrypted IP address
 *
 * IMPORTANT: Logs decryption event for audit trail
 *
 * @param encrypted - Encrypted string in format "iv:authTag:encrypted"
 * @param adminUserId - Admin user ID (for audit logging)
 * @param reason - Reason for decryption (for audit logging)
 * @returns Original IP address
 */
export function decryptIP(
	encrypted: string,
	adminUserId?: string,
	reason?: string
): string {
	const logger = getLogger();

	const parts = encrypted.split(':');
	if (parts.length !== 3) {
		throw new Error('Invalid encrypted IP format. Expected: iv:authTag:encrypted');
	}

	const [ivHex, authTagHex, encryptedHex] = parts;

	try {
		const key = getEncryptionKey();
		const iv = Buffer.from(ivHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');

		if (iv.length !== IV_LENGTH) {
			throw new Error(`Invalid IV length: ${iv.length} (expected ${IV_LENGTH})`);
		}
		if (authTag.length !== AUTH_TAG_LENGTH) {
			throw new Error(`Invalid auth tag length: ${authTag.length} (expected ${AUTH_TAG_LENGTH})`);
		}

		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		logger.warn('IP decryption performed', {
			component: 'ip-encryption',
			admin_user: adminUserId || 'unknown',
			reason: reason || 'not specified',
			timestamp: Date.now(),
			encrypted_prefix: encrypted.substring(0, 24),
			ip_prefix: decrypted.substring(0, 7)
		});

		return decrypted;
	} catch (error) {
		logger.error('IP decryption failed', {
			error: error instanceof Error ? error.message : 'Unknown error',
			admin_user: adminUserId || 'unknown',
			encrypted_prefix: encrypted.substring(0, 24)
		});
		throw new Error('IP decryption failed - data may be corrupted or key incorrect');
	}
}

/**
 * Validate encrypted IP format without decrypting
 */
export function isValidEncryptedIP(encrypted: string): boolean {
	const parts = encrypted.split(':');
	if (parts.length !== 3) return false;

	const [ivHex, authTagHex, encryptedHex] = parts;

	const hexRegex = /^[a-f0-9]+$/i;
	if (!hexRegex.test(ivHex) || !hexRegex.test(authTagHex) || !hexRegex.test(encryptedHex)) {
		return false;
	}

	if (ivHex.length !== IV_LENGTH * 2) return false;
	if (authTagHex.length !== AUTH_TAG_LENGTH * 2) return false;

	return true;
}

/**
 * Generate a secure encryption key
 *
 * @returns 64-character hexadecimal key (32 bytes)
 */
export function generateEncryptionKey(): string {
	return randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Mask an encrypted IP for display purposes
 */
export function maskEncryptedIP(encrypted: string): string {
	if (encrypted.length < 24) return encrypted;
	return encrypted.substring(0, 12) + '...' + encrypted.substring(encrypted.length - 8);
}
