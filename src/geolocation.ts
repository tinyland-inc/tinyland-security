/**
 * Geolocation Service
 *
 * Provides IP-based geolocation using MaxMind GeoLite2 database.
 * MaxMind is an optional dependency -- if the database is not available,
 * geolocation functions gracefully return null.
 *
 * @module geolocation
 */

import { getLogger } from './config.js';
import path from 'path';

type Reader = any;
type CityResponse = any;
type AsnResponse = any;

let geoipReader: Reader | null = null;
let asnReader: Reader | null = null;

/**
 * GeoIP location result
 */
export interface GeoLocation {
	country: string;
	countryCode: string;
	city: string | null;
	latitude: number | null;
	longitude: number | null;
	timezone: string | null;
	accuracyRadius: number | null;
}

/**
 * ASN lookup result
 */
export interface ASNResult {
	asn: number;
	organization: string;
	network: string;
}

/**
 * Initialize GeoIP reader
 *
 * Call this on server startup to load the MaxMind database.
 * Non-fatal if database is missing -- geolocation becomes optional.
 *
 * @param options - Optional configuration for database paths
 */
export async function initGeoIP(options?: {
	cityDbPath?: string;
	asnDbPath?: string;
}): Promise<void> {
	const logger = getLogger();

	try {
		const { Reader } = await import('@maxmind/geoip2-node');

		const cityDbPath = options?.cityDbPath || path.join(process.cwd(), 'data/geoip/GeoLite2-City.mmdb');
		geoipReader = await Reader.open(cityDbPath);

		logger.info('GeoIP City database loaded successfully', {
			'geoip.city_db_path': cityDbPath,
			'geoip.city_status': 'ready'
		});

		try {
			const asnDbPath = options?.asnDbPath || path.join(process.cwd(), 'data/geoip/GeoLite2-ASN.mmdb');
			asnReader = await Reader.open(asnDbPath);

			logger.info('GeoIP ASN database loaded successfully', {
				'geoip.asn_db_path': asnDbPath,
				'geoip.asn_status': 'ready'
			});
		} catch (asnError) {
			logger.warn('Failed to load ASN database - VPN detection will be limited', {
				error: asnError instanceof Error ? asnError.message : String(asnError),
				'geoip.asn_status': 'disabled'
			});
			asnReader = null;
		}
	} catch (error) {
		logger.warn('Failed to load GeoIP database - geolocation disabled', {
			error: error instanceof Error ? error.message : String(error),
			'geoip.status': 'disabled'
		});
		geoipReader = null;
		asnReader = null;
	}
}

/**
 * Get geolocation for IP address
 *
 * @param ip - IPv4 or IPv6 address
 * @returns Location data or null
 */
export function getLocation(ip: string): GeoLocation | null {
	if (!geoipReader) {
		return null;
	}

	try {
		const response: CityResponse = geoipReader.city(ip);

		return {
			country: response.country?.names?.en || 'Unknown',
			countryCode: response.country?.isoCode || 'XX',
			city: response.city?.names?.en || null,
			latitude: response.location?.latitude || null,
			longitude: response.location?.longitude || null,
			timezone: response.location?.timeZone || null,
			accuracyRadius: response.location?.accuracyRadius || null
		};
	} catch (error) {
		const logger = getLogger();
		logger.debug('GeoIP lookup failed', {
			ip,
			error: error instanceof Error ? error.message : String(error),
			errorType: error instanceof Error ? error.constructor.name : typeof error
		});
		return null;
	}
}

/**
 * Get ASN information for IP address
 *
 * @param ip - IPv4 or IPv6 address
 * @returns ASN data or null
 */
export function getASN(ip: string): ASNResult | null {
	if (!asnReader) {
		return null;
	}

	try {
		const response: AsnResponse = asnReader.asn(ip);

		return {
			asn: response.autonomousSystemNumber || 0,
			organization: response.autonomousSystemOrganization || 'Unknown',
			network: response.network || 'Unknown'
		};
	} catch {
		return null;
	}
}

/**
 * Check if GeoIP service is available
 */
export function isGeoIPAvailable(): boolean {
	return geoipReader !== null;
}

/**
 * Check if ASN lookup service is available
 */
export function isASNAvailable(): boolean {
	return asnReader !== null;
}

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 *
 * @param lat1 - Latitude of first point (-90 to 90)
 * @param lng1 - Longitude of first point (-180 to 180)
 * @param lat2 - Latitude of second point (-90 to 90)
 * @param lng2 - Longitude of second point (-180 to 180)
 * @returns Distance in kilometers
 */
export function haversineDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number {
	const R = 6371;
	const toRad = (deg: number) => (deg * Math.PI) / 180;

	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
		Math.sin(dLng / 2) * Math.sin(dLng / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

/**
 * Simple in-memory cache for reverse geocoding results
 */
const reverseGeoCache = new Map<string, {
	location: GeoLocation;
	timestamp: number;
}>();

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Reverse geocode coordinates to city name using OpenStreetMap Nominatim
 *
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param context - Optional context for structured logging
 * @returns GeoLocation with city name or null
 */
export async function reverseGeocode(
	latitude: number,
	longitude: number,
	context?: { fingerprintId?: string | null; sessionId?: string | null }
): Promise<GeoLocation | null> {
	const logger = getLogger();
	const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;

	const cached = reverseGeoCache.get(cacheKey);
	if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
		logger.debug('Reverse geocode cache hit', {
			fingerprintId: context?.fingerprintId || 'unknown',
			sessionId: context?.sessionId || 'unknown',
			latitude: latitude.toString(),
			longitude: longitude.toString(),
			cacheKey,
			city: cached.location.city ?? undefined,
			country: cached.location.country,
			cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000 / 60).toString()
		});
		return cached.location;
	}

	try {
		const url = new URL('https://nominatim.openstreetmap.org/reverse');
		url.searchParams.set('lat', latitude.toString());
		url.searchParams.set('lon', longitude.toString());
		url.searchParams.set('format', 'json');
		url.searchParams.set('zoom', '10');

		const response = await fetch(url.toString(), {
			headers: {
				'User-Agent': 'TinylandSecurity/1.0 (LGBTQ+ platform)',
				'Accept-Language': 'en'
			}
		});

		if (!response.ok) {
			logger.warn('Reverse geocoding API request failed', {
				fingerprintId: context?.fingerprintId ?? undefined,
				sessionId: context?.sessionId ?? undefined,
				status: response.status.toString(),
				statusText: response.statusText,
				latitude: latitude.toString(),
				longitude: longitude.toString(),
				cacheKey,
				apiEndpoint: 'nominatim.openstreetmap.org'
			});
			return null;
		}

		const data = await response.json() as Record<string, any>;

		const address = data.address || {};
		const city = address.city || address.town || address.village || address.county || null;
		const country = address.country || 'Unknown';
		const countryCode = address.country_code?.toUpperCase() || 'XX';

		const location: GeoLocation = {
			city,
			country,
			countryCode,
			latitude,
			longitude,
			timezone: null,
			accuracyRadius: null
		};

		reverseGeoCache.set(cacheKey, { location, timestamp: Date.now() });

		logger.info('Reverse geocoding API request successful', {
			fingerprintId: context?.fingerprintId ?? undefined,
			sessionId: context?.sessionId ?? undefined,
			latitude: latitude.toString(),
			longitude: longitude.toString(),
			city: city ?? undefined,
			country,
			countryCode,
			cacheKey,
			apiEndpoint: 'nominatim.openstreetmap.org',
			cachedForSeconds: (CACHE_TTL / 1000).toString()
		});

		return location;
	} catch (error) {
		logger.error('Reverse geocoding error', {
			fingerprintId: context?.fingerprintId ?? undefined,
			sessionId: context?.sessionId ?? undefined,
			error: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
			latitude: latitude.toString(),
			longitude: longitude.toString(),
			cacheKey
		});
		return null;
	}
}
