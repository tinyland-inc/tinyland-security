/**
 * User Agent Parsing Service
 *
 * Parses user agent strings to extract browser, OS, and device information.
 * Uses lightweight regex-based parsing (no external dependencies needed).
 *
 * @module userAgentParser
 */

import { getLogger } from './config.js';

/**
 * Parsed browser information
 */
export interface BrowserInfo {
	name: string;
	version: string;
	major: string;
	os: string;
	osVersion: string;
	engine: string;
	device: 'mobile' | 'tablet' | 'desktop';
	fullUA: string;
}

/**
 * Parse user agent string into structured browser info
 *
 * @param userAgent - User agent string from request headers
 * @returns Parsed browser information
 */
export function parseUserAgent(userAgent: string): BrowserInfo {
	const logger = getLogger();

	try {
		const result: BrowserInfo = {
			name: 'Unknown',
			version: 'Unknown',
			major: 'Unknown',
			os: 'Unknown',
			osVersion: 'Unknown',
			engine: 'Unknown',
			device: 'desktop',
			fullUA: userAgent
		};

		const browser = parseBrowser(userAgent);
		result.name = browser.name;
		result.version = browser.version;
		result.major = browser.major;

		const os = parseOS(userAgent);
		result.os = os.name;
		result.osVersion = os.version;

		result.engine = parseEngine(userAgent);
		result.device = detectDeviceTypeFromUA(userAgent);

		logger.debug('User agent parsed successfully', {
			browser: result.name,
			os: result.os,
			device: result.device
		});

		return result;
	} catch (error) {
		logger.error('Failed to parse user agent', {
			error: error instanceof Error ? error.message : String(error),
			userAgent: userAgent.substring(0, 100)
		});

		return {
			name: 'Unknown',
			version: 'Unknown',
			major: 'Unknown',
			os: 'Unknown',
			osVersion: 'Unknown',
			engine: 'Unknown',
			device: 'desktop',
			fullUA: userAgent
		};
	}
}

function parseBrowser(ua: string): { name: string; version: string; major: string } {
	if (/Edg\//i.test(ua)) {
		const match = ua.match(/Edg\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
		if (match) {
			return { name: 'Microsoft Edge', version: `${match[1]}.${match[2]}.${match[3]}`, major: match[1] };
		}
	}

	if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
		const match = ua.match(/Chrome\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
		if (match) {
			return { name: 'Chrome', version: `${match[1]}.${match[2]}.${match[3]}`, major: match[1] };
		}
	}

	if (/Firefox/i.test(ua)) {
		const match = ua.match(/Firefox\/(\d+)\.(\d+)/);
		if (match) {
			return { name: 'Firefox', version: `${match[1]}.${match[2]}`, major: match[1] };
		}
	}

	if (/Safari/i.test(ua) && !/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
		const match = ua.match(/Version\/(\d+)\.(\d+)/);
		if (match) {
			return { name: 'Safari', version: `${match[1]}.${match[2]}`, major: match[1] };
		}
	}

	if (/OPR/i.test(ua)) {
		const match = ua.match(/OPR\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
		if (match) {
			return { name: 'Opera', version: `${match[1]}.${match[2]}.${match[3]}`, major: match[1] };
		}
	}

	if (/Brave/i.test(ua)) {
		return { name: 'Brave', version: 'Unknown', major: 'Unknown' };
	}

	return { name: 'Unknown Browser', version: 'Unknown', major: 'Unknown' };
}

function parseOS(ua: string): { name: string; version: string } {
	if (/Windows NT/i.test(ua)) {
		const versionMap: Record<string, string> = {
			'10.0': '11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP'
		};
		const match = ua.match(/Windows NT (\d+\.\d+)/);
		if (match) {
			const version = versionMap[match[1]] || match[1];
			const isWin11 = /Windows NT 10\.0/.test(ua) && /Win64/.test(ua);
			return { name: 'Windows', version: isWin11 ? '11' : version };
		}
		return { name: 'Windows', version: 'Unknown' };
	}

	if (/Mac OS X/i.test(ua)) {
		const match = ua.match(/Mac OS X (\d+)[._](\d+)(?:[._](\d+))?/);
		if (match) {
			return { name: 'macOS', version: `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}` };
		}
		return { name: 'macOS', version: 'Unknown' };
	}

	if (/Linux/i.test(ua)) {
		if (/Ubuntu/i.test(ua)) return { name: 'Ubuntu', version: 'Unknown' };
		if (/Fedora/i.test(ua)) return { name: 'Fedora', version: 'Unknown' };
		return { name: 'Linux', version: 'Unknown' };
	}

	if (/iPhone|iPad|iPod/i.test(ua)) {
		const match = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
		if (match) {
			return { name: 'iOS', version: `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}` };
		}
		return { name: 'iOS', version: 'Unknown' };
	}

	if (/Android/i.test(ua)) {
		const match = ua.match(/Android (\d+)\.(\d+)(?:\.(\d+))?/);
		if (match) {
			return { name: 'Android', version: `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}` };
		}
		return { name: 'Android', version: 'Unknown' };
	}

	return { name: 'Unknown OS', version: 'Unknown' };
}

function parseEngine(ua: string): string {
	if (/AppleWebKit/i.test(ua)) {
		if (/Chrome|Edg/i.test(ua)) return 'Blink';
		return 'WebKit';
	}
	if (/Gecko/i.test(ua) && !/like Gecko/i.test(ua)) return 'Gecko';
	if (/Trident/i.test(ua)) return 'Trident';
	if (/Presto/i.test(ua)) return 'Presto';
	return 'Unknown';
}

function detectDeviceTypeFromUA(ua: string): 'mobile' | 'tablet' | 'desktop' {
	if (/iPad/i.test(ua)) return 'tablet';
	if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
	if (/Mobile|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile|WPDesktop/i.test(ua)) return 'mobile';
	return 'desktop';
}

/**
 * Get a human-friendly browser description
 */
export function getBrowserDescription(info: BrowserInfo): string {
	const browserPart = info.version !== 'Unknown' ? `${info.name} ${info.major}` : info.name;
	const osPart = info.osVersion !== 'Unknown' ? `${info.os} ${info.osVersion}` : info.os;
	return `${browserPart} on ${osPart}`;
}
