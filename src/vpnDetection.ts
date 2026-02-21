/**
 * VPN Detection Service
 *
 * ASN-based VPN detection using MaxMind GeoLite2-ASN database.
 * Identifies VPN providers and datacenter IPs with high accuracy.
 *
 * @module vpnDetection
 */

import { createHash } from 'crypto';
import { getLogger } from './config.js';
import { getASN, isASNAvailable } from './geolocation.js';

/**
 * VPN Provider Detection Result
 */
export interface VPNDetectionResult {
	isVPN: boolean;
	provider: string | null;
	confidence: 'low' | 'medium' | 'high';
	method: 'asn' | 'datacenter' | 'unknown';
	details?: string;
}

/**
 * Known VPN provider ASN ranges
 */
const KNOWN_VPN_ASNS: Record<number, string> = {
	209605: 'NordVPN',
	213414: 'ProtonVPN',
	34939: 'Mullvad',
	396303: 'ExpressVPN',
	328543: 'Surfshark',
	46562: 'Private Internet Access',
	46844: 'TunnelBear',
	54290: 'Windscribe',
	35916: 'IPVanish',
	9009: 'CyberGhost',
	201706: 'PrivateVPN',
	11878: 'VyprVPN'
};

/**
 * Known datacenter/hosting provider ASNs
 */
const DATACENTER_ASNS: Record<number, string> = {
	16509: 'Amazon Web Services',
	14618: 'Amazon AWS',
	15169: 'Google Cloud',
	8075: 'Microsoft Azure',
	14061: 'DigitalOcean',
	63949: 'Linode',
	20473: 'Vultr',
	16276: 'OVH',
	24940: 'Hetzner'
};

/**
 * Detect VPN based on IP address
 *
 * @param ip - IPv4 or IPv6 address
 * @returns VPN detection result with confidence level
 */
export async function detectVPN(ip: string): Promise<VPNDetectionResult> {
	const logger = getLogger();

	try {
		if (isPrivateIP(ip)) {
			return {
				isVPN: false,
				provider: null,
				confidence: 'high',
				method: 'unknown',
				details: 'Private/local IP address'
			};
		}

		const asnResult = await lookupASN(ip);

		if (asnResult) {
			if (KNOWN_VPN_ASNS[asnResult.asn]) {
				logger.info('VPN detected via known provider ASN', {
					ip: hashIP(ip),
					asn: asnResult.asn.toString(),
					provider: KNOWN_VPN_ASNS[asnResult.asn]
				});

				return {
					isVPN: true,
					provider: KNOWN_VPN_ASNS[asnResult.asn],
					confidence: 'high',
					method: 'asn',
					details: `ASN ${asnResult.asn} matches known VPN provider`
				};
			}

			if (DATACENTER_ASNS[asnResult.asn]) {
				logger.info('Possible VPN detected via datacenter ASN', {
					ip: hashIP(ip),
					asn: asnResult.asn.toString(),
					datacenter: DATACENTER_ASNS[asnResult.asn]
				});

				return {
					isVPN: true,
					provider: null,
					confidence: 'medium',
					method: 'datacenter',
					details: `Datacenter IP (${DATACENTER_ASNS[asnResult.asn]}), likely VPN/proxy`
				};
			}
		}

		return {
			isVPN: false,
			provider: null,
			confidence: 'low',
			method: 'unknown',
			details: 'No VPN indicators found'
		};
	} catch (error) {
		logger.error('VPN detection failed', {
			error: error instanceof Error ? error.message : String(error)
		});

		return {
			isVPN: false,
			provider: null,
			confidence: 'low',
			method: 'unknown',
			details: 'Detection error'
		};
	}
}

/**
 * Check if IP is private/local (RFC 1918, loopback, link-local)
 */
export function isPrivateIP(ip: string): boolean {
	const ipv4Private = [
		/^127\./,
		/^10\./,
		/^172\.(1[6-9]|2[0-9]|3[01])\./,
		/^192\.168\./,
		/^169\.254\./
	];

	const ipv6Private = [
		/^::1$/,
		/^fe80:/,
		/^fc00:/,
		/^fd00:/
	];

	return ipv4Private.some((regex) => regex.test(ip)) || ipv6Private.some((regex) => regex.test(ip));
}

/**
 * Hash IP for privacy-compliant logging
 */
function hashIP(ip: string): string {
	return createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

/**
 * ASN Lookup Interface
 */
interface ASNLookupResult {
	asn: number;
	organization: string;
}

/**
 * Lookup ASN for IP address using the geolocation module
 */
async function lookupASN(ip: string): Promise<ASNLookupResult | null> {
	if (!isASNAvailable()) {
		return null;
	}

	const asnData = getASN(ip);
	if (!asnData) {
		return null;
	}

	return {
		asn: asnData.asn,
		organization: asnData.organization
	};
}

/**
 * Get VPN detection capabilities status
 */
export function getVPNDetectionCapabilities() {
	const asnAvailable = isASNAvailable();

	return {
		methods: ['asn', 'datacenter'] as const,
		asnLookupEnabled: asnAvailable,
		knownVPNProvidersCount: Object.keys(KNOWN_VPN_ASNS).length,
		datacenterProvidersCount: Object.keys(DATACENTER_ASNS).length,
		accuracy: asnAvailable ? 'high' : 'medium',
		privacyFriendly: true
	};
}
