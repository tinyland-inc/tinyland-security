










import * as crypto from 'crypto';
import { getSecurityConfig } from './config.js';
import { getLogger } from './config.js';












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







export function maskIp(ip: string): string {
	const parts = ip.split('.');
	if (parts.length === 4) {
		return `${parts[0]}.${parts[1]}.*.*`;
	}
	return ip;
}







export function isValidIpHash(hash: string): boolean {
	return /^[a-f0-9]{16}$/.test(hash);
}






export function generateSalt(): string {
	return crypto.randomBytes(32).toString('hex');
}
