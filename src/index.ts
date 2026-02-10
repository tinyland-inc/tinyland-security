/**
 * @tinyland-inc/tinyland-security
 *
 * Security primitives for IP hashing, encryption, risk scoring,
 * device detection, VPN detection, rate limiting, and timing-safe utilities.
 *
 * Usage:
 * ```typescript
 * import { configureSecurity, hashIp, detectVPN } from '@tinyland-inc/tinyland-security';
 *
 * // Initialize once at startup
 * configureSecurity({
 *   config: {
 *     ipEncryptionKey: process.env.IP_ENCRYPTION_KEY,
 *     ipHashSalt: process.env.IP_HASH_SALT,
 *     nodeEnv: process.env.NODE_ENV,
 *   },
 *   logger: myStructuredLogger,
 * });
 *
 * // Use security functions
 * const hashedIp = hashIp('192.168.1.1');
 * const vpnResult = await detectVPN('8.8.8.8');
 * ```
 *
 * @module @tinyland-inc/tinyland-security
 */

// Configuration
export { configureSecurity, getSecurityConfig, getLogger, resetSecurityConfig } from './config.js';

// Types
export type {
	SecurityConfig,
	SecurityLogger,
	SecurityRequest,
	DeviceType,
	RiskScore,
	RiskFactor,
	VPNDetectionResult,
	GeoLocation,
	ASNResult,
	BrowserInfo,
	AnomalyResult,
	RateLimitConfig,
	RateLimitResult,
	RateLimitStats,
	RateLimitEntry,
	TempFingerprintInputs,
} from './types.js';
export type { RiskScoringInput } from './riskScoring.js';

// IP Hashing
export { hashIp, maskIp, isValidIpHash, generateSalt } from './ipHashing.js';

// IP Encryption
export {
	encryptIP, decryptIP,
	isValidEncryptedIP, generateEncryptionKey, maskEncryptedIP
} from './ipEncryption.js';

// Fingerprint Hashing
export { hashFingerprint, verifyFingerprint } from './fingerprintHashing.js';

// Risk Scoring
export {
	calculateRiskScore, getRiskTier, getRiskColor, getRiskBadgeVariant,
	RISK_WEIGHTS
} from './riskScoring.js';

// Device Detection
export { detectDeviceType, extractBrowserInfo, extractOSInfo } from './deviceDetection.js';

// User Agent Parser
export { parseUserAgent, getBrowserDescription } from './userAgentParser.js';

// VPN Detection
export { detectVPN, isPrivateIP, getVPNDetectionCapabilities } from './vpnDetection.js';

// Geolocation
export {
	initGeoIP, getLocation, getASN,
	isGeoIPAvailable, isASNAvailable,
	haversineDistance, reverseGeocode
} from './geolocation.js';

// Login Anomaly Detection
export { detectLoginAnomaly, getUserLoginHistory, clearUserLoginHistory } from './loginAnomaly.js';

// Rate Limiting
export {
	RateLimiter,
	getClientIP, createIPKey, createSessionKey, createAccountKey,
	RATE_LIMIT_CONFIGS
} from './rateLimit.js';
export { RateLimitStore } from './rateLimitStore.js';

// Timing-Safe Utilities
export {
	constantTimeCompare, timingSafeVerify,
	timingSafeQuery, timingSafeError,
	TimingMetrics, timingMetrics
} from './timingSafe.js';

// Secure Cookies
export {
	SECURE_COOKIE_OPTIONS, SESSION_COOKIE_OPTIONS,
	TEMP_COOKIE_OPTIONS, BOOTSTRAP_COOKIE_OPTIONS,
	AUTH_DATA_COOKIE_OPTIONS, DELETE_COOKIE_OPTIONS,
	createDeleteOptions
} from './secureCookies.js';

// Temporary Fingerprint
export {
	generateTempFingerprint, isTempFingerprint,
	getTempFingerprintHash, isValidTempFingerprint
} from './temporaryFingerprint.js';

// IP Bans
export {
	isIpBanned, addIpBan, removeIpBan,
	deactivateIpBan, getActiveBans, cleanupExpiredBans,
	configureIpBanStore
} from './ipBans.js';
