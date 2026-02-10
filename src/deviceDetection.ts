/**
 * Device Type Detection from User-Agent
 *
 * Classifies devices as mobile, tablet, or desktop based on User-Agent strings.
 * Uses simple but effective regex patterns.
 *
 * @module deviceDetection
 */

import type { DeviceType } from './types.js';

/**
 * Detect device type from User-Agent string
 *
 * @param userAgent - User-Agent header value
 * @returns Device type classification
 */
export function detectDeviceType(userAgent: string): DeviceType {
	if (!userAgent) {
		return 'unknown';
	}

	const ua = userAgent.toLowerCase();

	// Mobile devices
	const mobilePatterns = [
		/android/i,
		/webos/i,
		/iphone/i,
		/ipod/i,
		/blackberry/i,
		/windows phone/i,
		/mobile/i
	];

	// Tablet devices (check before mobile, as some tablets have "mobile" in UA)
	const tabletPatterns = [
		/ipad/i,
		/android(?!.*mobile)/i,  // Android but not mobile (tablet)
		/tablet/i,
		/kindle/i,
		/silk/i,
		/playbook/i
	];

	// Check tablets first (more specific)
	if (tabletPatterns.some(pattern => pattern.test(ua))) {
		return 'tablet';
	}

	// Then check mobile
	if (mobilePatterns.some(pattern => pattern.test(ua))) {
		return 'mobile';
	}

	// Default to desktop
	return 'desktop';
}

/**
 * Extract browser name and version from User-Agent
 *
 * @param userAgent - User-Agent header value
 * @returns Browser info object
 */
export function extractBrowserInfo(userAgent: string): {
	name: string;
	version: string;
} {
	if (!userAgent) {
		return { name: 'unknown', version: 'unknown' };
	}

	const ua = userAgent.toLowerCase();

	if (ua.includes('chrome') && !ua.includes('edg')) {
		const match = ua.match(/chrome\/([\d.]+)/);
		return { name: 'Chrome', version: match ? match[1] : 'unknown' };
	}

	if (ua.includes('edg')) {
		const match = ua.match(/edg\/([\d.]+)/);
		return { name: 'Edge', version: match ? match[1] : 'unknown' };
	}

	if (ua.includes('firefox')) {
		const match = ua.match(/firefox\/([\d.]+)/);
		return { name: 'Firefox', version: match ? match[1] : 'unknown' };
	}

	if (ua.includes('safari') && !ua.includes('chrome')) {
		const match = ua.match(/version\/([\d.]+)/);
		return { name: 'Safari', version: match ? match[1] : 'unknown' };
	}

	if (ua.includes('opera') || ua.includes('opr')) {
		const match = ua.match(/(?:opera|opr)\/([\d.]+)/);
		return { name: 'Opera', version: match ? match[1] : 'unknown' };
	}

	return { name: 'unknown', version: 'unknown' };
}

/**
 * Extract OS name and version from User-Agent
 *
 * @param userAgent - User-Agent header value
 * @returns OS info object
 */
export function extractOSInfo(userAgent: string): {
	name: string;
	version: string;
} {
	if (!userAgent) {
		return { name: 'unknown', version: 'unknown' };
	}

	const ua = userAgent.toLowerCase();

	if (ua.includes('windows')) {
		if (ua.includes('windows nt 10.0')) return { name: 'Windows', version: '10/11' };
		if (ua.includes('windows nt 6.3')) return { name: 'Windows', version: '8.1' };
		if (ua.includes('windows nt 6.2')) return { name: 'Windows', version: '8' };
		if (ua.includes('windows nt 6.1')) return { name: 'Windows', version: '7' };
		return { name: 'Windows', version: 'unknown' };
	}

	if (ua.includes('mac os x')) {
		const match = ua.match(/mac os x ([\d_]+)/);
		const version = match ? match[1].replace(/_/g, '.') : 'unknown';
		return { name: 'macOS', version };
	}

	if (ua.includes('iphone') || ua.includes('ipad')) {
		const match = ua.match(/os ([\d_]+)/);
		const version = match ? match[1].replace(/_/g, '.') : 'unknown';
		return { name: 'iOS', version };
	}

	if (ua.includes('android')) {
		const match = ua.match(/android ([\d.]+)/);
		return { name: 'Android', version: match ? match[1] : 'unknown' };
	}

	if (ua.includes('linux')) {
		return { name: 'Linux', version: 'unknown' };
	}

	return { name: 'unknown', version: 'unknown' };
}
