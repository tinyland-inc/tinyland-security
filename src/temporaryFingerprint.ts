













import { createHash } from 'crypto';

export interface TempFingerprintInputs {
	ip: string;
	userAgent: string;
	acceptLanguage?: string | null;
	timestamp?: number;
}







export function generateTempFingerprint(inputs: TempFingerprintInputs): string {
	const {
		ip,
		userAgent,
		acceptLanguage = 'unknown',
		timestamp = Date.now()
	} = inputs;

	const hourBucket = Math.floor(timestamp / (60 * 60 * 1000));

	const fingerprintData = [
		ip,
		userAgent,
		acceptLanguage || 'unknown',
		hourBucket.toString()
	].join('|');

	const hash = createHash('sha256')
		.update(fingerprintData)
		.digest('hex')
		.slice(0, 32);

	return `temp_${hash}`;
}




export function isTempFingerprint(fingerprintId: string | null | undefined): boolean {
	return !!fingerprintId && fingerprintId.startsWith('temp_');
}




export function getTempFingerprintHash(tempFingerprintId: string): string | null {
	if (!isTempFingerprint(tempFingerprintId)) {
		return null;
	}
	return tempFingerprintId.slice(5);
}




export function isValidTempFingerprint(fingerprintId: string): boolean {
	const regex = /^temp_[0-9a-f]{32}$/i;
	return regex.test(fingerprintId);
}
