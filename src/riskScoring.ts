













import { getLogger } from './config.js';






export interface RiskScoringInput {
	fingerprintId: string;
	fingerprintHash?: string;
	timestamp: string;
	sessionId: string | null;
	userId: string | null;
	geoLocation: {
		country: string;
		countryCode?: string;
		city: string | null;
		latitude: number | null;
		longitude: number | null;
		timezone: string | null;
	} | null;
	vpnDetection: {
		isVPN: boolean;
		provider: string | null;
		confidence: 'low' | 'medium' | 'high';
		method: 'asn' | 'datacenter' | 'unknown';
	};
	eventType: string;
	userFlags?: {
		totpEnabled: boolean;
		isActive: boolean;
		failedLoginAttempts: number;
	};
}




export const RISK_WEIGHTS = {
	vpnDetected: 10,
	datacenterIp: 20,
	vpnHighConfidence: 5,
	fingerprintMismatch: 50,
	impossibleTravel: 40,
	totpDisabled: 15,
	newLocation: 10,
	unusualTime: 5,
	failedAttempts: 5,
	userInactive: 10,
	multipleSessions: 3
} as const;




export interface RiskScore {
	score: number;
	tier: 'low' | 'medium' | 'high' | 'critical';
	factors: RiskFactor[];
	recommendation: string;
}




export interface RiskFactor {
	name: string;
	weight: number;
	reason: string;
}








export function calculateRiskScore(
	enriched: RiskScoringInput,
	options: {
		previousLocation?: { country: string; city: string | null; timestamp: string; latitude: number | null; longitude: number | null } | null;
		concurrentSessions?: number;
	} = {}
): RiskScore {
	const logger = getLogger();
	let score = 0;
	const factors: RiskFactor[] = [];

	
	if (enriched.vpnDetection.isVPN) {
		const vpnWeight = RISK_WEIGHTS.vpnDetected;
		score += vpnWeight;
		factors.push({
			name: 'VPN Detected',
			weight: vpnWeight,
			reason: enriched.vpnDetection.provider
				? `VPN provider: ${enriched.vpnDetection.provider}`
				: 'VPN usage detected'
		});

		if (enriched.vpnDetection.confidence === 'high') {
			score += RISK_WEIGHTS.vpnHighConfidence;
			factors.push({
				name: 'High VPN Confidence',
				weight: RISK_WEIGHTS.vpnHighConfidence,
				reason: 'VPN detected with high confidence'
			});
		}
	}

	
	if (enriched.vpnDetection.method === 'datacenter') {
		const datacenterWeight = RISK_WEIGHTS.datacenterIp;
		score += datacenterWeight;
		factors.push({
			name: 'Datacenter IP',
			weight: datacenterWeight,
			reason: 'Login from datacenter/hosting provider IP'
		});
	}

	
	if (enriched.eventType === 'fingerprint_mismatch') {
		const mismatchWeight = RISK_WEIGHTS.fingerprintMismatch;
		score += mismatchWeight;
		factors.push({
			name: 'Fingerprint Mismatch',
			weight: mismatchWeight,
			reason: 'Browser fingerprint changed (possible session hijacking)'
		});
	}

	
	if (options.previousLocation && enriched.geoLocation) {
		const travelCheck = checkImpossibleTravel(
			options.previousLocation,
			{
				country: enriched.geoLocation.country,
				city: enriched.geoLocation.city,
				timestamp: enriched.timestamp,
				latitude: enriched.geoLocation.latitude,
				longitude: enriched.geoLocation.longitude
			}
		);

		if (travelCheck.impossible) {
			const travelWeight = RISK_WEIGHTS.impossibleTravel;
			score += travelWeight;
			factors.push({
				name: 'Impossible Travel',
				weight: travelWeight,
				reason: travelCheck.reason
			});
		}
	}

	
	if (enriched.userFlags && !enriched.userFlags.totpEnabled) {
		const totpWeight = RISK_WEIGHTS.totpDisabled;
		score += totpWeight;
		factors.push({
			name: 'No 2FA',
			weight: totpWeight,
			reason: 'User has not enabled TOTP two-factor authentication'
		});
	}

	
	if (options.previousLocation && enriched.geoLocation) {
		if (
			options.previousLocation.country !== enriched.geoLocation.country ||
			options.previousLocation.city !== enriched.geoLocation.city
		) {
			const newLocationWeight = RISK_WEIGHTS.newLocation;
			score += newLocationWeight;
			factors.push({
				name: 'New Location',
				weight: newLocationWeight,
				reason: `Login from new location: ${enriched.geoLocation.city ? `${enriched.geoLocation.city}, ` : ''}${enriched.geoLocation.country}`
			});
		}
	}

	
	if (enriched.geoLocation?.timezone) {
		const isUnusualTime = checkUnusualTime(enriched.timestamp, enriched.geoLocation.timezone);
		if (isUnusualTime) {
			const timeWeight = RISK_WEIGHTS.unusualTime;
			score += timeWeight;
			factors.push({
				name: 'Unusual Time',
				weight: timeWeight,
				reason: 'Login during unusual hours (2-5 AM local time)'
			});
		}
	}

	
	if (enriched.userFlags && enriched.userFlags.failedLoginAttempts > 0) {
		const failedWeight = RISK_WEIGHTS.failedAttempts * enriched.userFlags.failedLoginAttempts;
		score += failedWeight;
		factors.push({
			name: 'Failed Login Attempts',
			weight: failedWeight,
			reason: `${enriched.userFlags.failedLoginAttempts} recent failed login attempts`
		});
	}

	
	if (enriched.userFlags && !enriched.userFlags.isActive) {
		const inactiveWeight = RISK_WEIGHTS.userInactive;
		score += inactiveWeight;
		factors.push({
			name: 'Inactive User',
			weight: inactiveWeight,
			reason: 'User account marked as inactive'
		});
	}

	
	if (options.concurrentSessions && options.concurrentSessions > 1) {
		const sessionWeight = RISK_WEIGHTS.multipleSessions * (options.concurrentSessions - 1);
		score += sessionWeight;
		factors.push({
			name: 'Multiple Sessions',
			weight: sessionWeight,
			reason: `${options.concurrentSessions} concurrent active sessions`
		});
	}

	const tier = getRiskTier(score);
	const recommendation = getRiskRecommendation(tier);

	logger.info('Risk score calculated', {
		score: score.toString(),
		tier: tier.toString(),
		factors: JSON.stringify(factors.map(f => ({ name: f.name, weight: f.weight }))),
		user_id: enriched.userId ?? undefined,
		session_id: enriched.sessionId ?? undefined,
		fingerprint_hash: enriched.fingerprintHash?.slice(0, 16)
	});

	return { score, tier, factors, recommendation };
}




function calculateDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 6371;
	const toRadians = (degrees: number) => degrees * (Math.PI / 180);

	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) *
			Math.cos(toRadians(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}




function checkImpossibleTravel(
	previous: { country: string; city: string | null; timestamp: string; latitude: number | null; longitude: number | null },
	current: { country: string; city: string | null; timestamp: string; latitude: number | null; longitude: number | null }
): { impossible: boolean; reason: string } {
	if (!current.latitude || !current.longitude || !previous.latitude || !previous.longitude) {
		const timeDiff = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
		const hoursDiff = timeDiff / (1000 * 60 * 60);

		if (previous.country !== current.country && hoursDiff < 1) {
			return {
				impossible: true,
				reason: `Location changed from ${previous.country} to ${current.country} in ${Math.round(hoursDiff * 60)} minutes`
			};
		}

		return { impossible: false, reason: '' };
	}

	const distanceKm = calculateDistance(
		previous.latitude, previous.longitude,
		current.latitude, current.longitude
	);

	const timeElapsedMs = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
	const hours = timeElapsedMs / (1000 * 60 * 60);

	if (distanceKm < 50) {
		return { impossible: false, reason: '' };
	}

	const requiredSpeed = distanceKm / hours;

	if (hours < 1) {
		if (requiredSpeed > 500) {
			return {
				impossible: true,
				reason: `Travel of ${distanceKm.toFixed(0)}km from ${previous.city || previous.country} to ${current.city || current.country} in ${(hours * 60).toFixed(0)} minutes requires ${requiredSpeed.toFixed(0)}km/h (exceeds ground transport speed)`
			};
		}
	} else {
		if (requiredSpeed > 900) {
			return {
				impossible: true,
				reason: `Travel of ${distanceKm.toFixed(0)}km from ${previous.city || previous.country} to ${current.city || current.country} in ${hours.toFixed(1)} hours requires ${requiredSpeed.toFixed(0)}km/h (exceeds commercial aircraft speed)`
			};
		}
	}

	return { impossible: false, reason: '' };
}




function checkUnusualTime(timestamp: string, _timezone: string): boolean {
	try {
		const date = new Date(timestamp);
		const hour = date.getHours();
		return hour >= 2 && hour <= 5;
	} catch {
		return false;
	}
}




export function getRiskTier(score: number): 'low' | 'medium' | 'high' | 'critical' {
	if (score >= 81) return 'critical';
	if (score >= 51) return 'high';
	if (score >= 21) return 'medium';
	return 'low';
}




function getRiskRecommendation(tier: string): string {
	switch (tier) {
		case 'critical':
			return 'CRITICAL: Terminate session immediately and notify security team. Possible account compromise.';
		case 'high':
			return 'HIGH RISK: Require TOTP re-authentication. Monitor closely for additional suspicious activity.';
		case 'medium':
			return 'MODERATE RISK: Increase monitoring. Consider additional authentication challenges.';
		case 'low':
		default:
			return 'Low risk. Normal security monitoring applies.';
	}
}




export function getRiskColor(tier: string): string {
	switch (tier) {
		case 'critical': return 'error';
		case 'high': return 'warning';
		case 'medium': return 'tertiary';
		case 'low': return 'success';
		default: return 'surface';
	}
}




export function getRiskBadgeVariant(tier: string): string {
	switch (tier) {
		case 'critical': return 'variant-filled-error';
		case 'high': return 'variant-filled-warning';
		case 'medium': return 'variant-soft-warning';
		case 'low': return 'variant-soft-success';
		default: return 'variant-soft-surface';
	}
}
