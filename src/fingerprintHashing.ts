








import { createHash } from 'crypto';
import { getSecurityConfig } from './config.js';










export async function hashFingerprint(fingerprint: string): Promise<string> {
	const config = getSecurityConfig();
	const salt = config.fingerprintSalt || config.ipHashSalt || 'dev-salt-change-in-production';

	const hash = createHash('sha256');
	hash.update(fingerprint + salt);

	return hash.digest('hex');
}








export async function verifyFingerprint(fingerprint: string, hash: string): Promise<boolean> {
	const computedHash = await hashFingerprint(fingerprint);
	return computedHash === hash;
}
