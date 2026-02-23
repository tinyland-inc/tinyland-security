








import { getLocation, type GeoLocation } from './geolocation.js';
import { getLogger } from './config.js';

interface LoginHistory {
	userId: string;
	locations: Set<string>;
	lastLoginCountry: string | null;
	lastLoginTime: Date | null;
}

const loginHistories = new Map<string, LoginHistory>();

export interface AnomalyResult {
	anomaly: boolean;
	reason?: string;
	location?: GeoLocation;
	severity?: 'low' | 'medium' | 'high';
}








export async function detectLoginAnomaly(
	userId: string,
	clientIp: string
): Promise<AnomalyResult> {
	const logger = getLogger();
	const location = getLocation(clientIp);

	if (!location) {
		return { anomaly: false, reason: 'geolocation_unavailable' };
	}

	const locationKey = `${location.countryCode}:${location.city || 'unknown'}`;

	let history = loginHistories.get(userId);
	if (!history) {
		history = {
			userId,
			locations: new Set([locationKey]),
			lastLoginCountry: location.countryCode,
			lastLoginTime: new Date()
		};
		loginHistories.set(userId, history);

		logger.info('New user login history created', {
			'user.id': userId,
			'geo.country': location.country,
			'geo.city': location.city ?? undefined
		});

		return { anomaly: false, location };
	}

	const isNewCountry = history.lastLoginCountry !== location.countryCode;
	const now = new Date();
	const timeSinceLastLogin = history.lastLoginTime
		? (now.getTime() - history.lastLoginTime.getTime()) / 1000 / 60
		: Infinity;

	if (isNewCountry) {
		const isImpossibleTravel = timeSinceLastLogin < 240;
		const severity: 'low' | 'medium' | 'high' = isImpossibleTravel ? 'high' : 'medium';

		logger.warn('Unusual login location detected', {
			'user.id': userId,
			'geo.country': location.country,
			'geo.country_code': location.countryCode,
			'geo.city': location.city ?? undefined,
			'geo.previous_country': history.lastLoginCountry ?? undefined,
			'login.time_since_last': Math.round(timeSinceLastLogin).toString(),
			'alert.type': 'unusual_location',
			'alert.severity': severity.toString(),
			'impossible_travel': isImpossibleTravel.toString()
		});

		history.locations.add(locationKey);
		history.lastLoginCountry = location.countryCode;
		history.lastLoginTime = now;
		loginHistories.set(userId, history);

		return {
			anomaly: true,
			reason: isImpossibleTravel ? 'impossible_travel' : 'new_country',
			location,
			severity
		};
	}

	history.lastLoginTime = now;
	history.locations.add(locationKey);
	loginHistories.set(userId, history);

	return { anomaly: false, location };
}




export function getUserLoginHistory(userId: string): LoginHistory | null {
	return loginHistories.get(userId) || null;
}




export function clearUserLoginHistory(userId: string): void {
	const logger = getLogger();
	const removed = loginHistories.delete(userId);

	if (removed) {
		logger.info('Login history cleared for user', {
			'user.id': userId,
			'trace_context': 'login_history_clear'
		});
	}
}
