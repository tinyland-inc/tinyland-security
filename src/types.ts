

















export interface SecurityConfig {
	
	ipEncryptionKey?: string;
	
	ipHashSalt?: string;
	
	fingerprintSalt?: string;
	
	nodeEnv?: string;
	
	rateLimitBypass?: boolean;
}









export interface SecurityLogger {
	info(message: string, data?: Record<string, unknown>): void;
	warn(message: string, data?: Record<string, unknown>): void;
	error(message: string, data?: Record<string, unknown>): void;
	debug(message: string, data?: Record<string, unknown>): void;
	child?(meta: Record<string, unknown>): SecurityLogger;
}









export interface SecurityRequest {
	headers: Headers;
	url: string;
}








export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';





export type { RiskScore, RiskFactor } from './riskScoring.js';
export type { VPNDetectionResult } from './vpnDetection.js';
export type { GeoLocation, ASNResult } from './geolocation.js';
export type { BrowserInfo } from './userAgentParser.js';
export type { AnomalyResult } from './loginAnomaly.js';
export type { RateLimitConfig, RateLimitResult, RateLimitStats, RateLimitEntry } from './rateLimit.js';
export type { TempFingerprintInputs } from './temporaryFingerprint.js';
