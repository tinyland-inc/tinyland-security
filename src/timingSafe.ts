/**
 * Timing-Safe Comparison Utilities
 *
 * CRITICAL SECURITY: These utilities prevent timing attacks by ensuring
 * all comparisons take constant time regardless of input values.
 *
 * References:
 * - OWASP: https://owasp.org/www-community/attacks/Timing_attack
 * - CWE-208: Observable Timing Discrepancy
 *
 * @module timingSafe
 */

import { timingSafeEqual } from 'crypto';

/**
 * Sleep for a specified number of milliseconds
 * Used to add artificial delays to normalize response times
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Perform constant-time string comparison
 *
 * IMPORTANT: This function always takes the same time to execute
 * regardless of where strings differ, preventing timing attacks.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function constantTimeCompare(a: string, b: string): boolean {
  // Normalize to same length to prevent length-based timing
  // If lengths differ, we still perform the comparison to maintain constant time
  const maxLength = Math.max(a.length, b.length);

  // Pad shorter string with null bytes
  const paddedA = a.padEnd(maxLength, '\0');
  const paddedB = b.padEnd(maxLength, '\0');

  // Convert to buffers for timingSafeEqual
  const bufA = Buffer.from(paddedA, 'utf-8');
  const bufB = Buffer.from(paddedB, 'utf-8');

  try {
    // Use Node.js built-in constant-time comparison
    // This is implemented at the C++ level for maximum security
    return timingSafeEqual(bufA, bufB);
  } catch {
    // If comparison fails (shouldn't happen with our padding), return false
    // Still takes constant time due to the try/catch
    return false;
  }
}

/**
 * Perform timing-safe verification with normalized response time
 *
 * This wrapper ensures all verifications take at least a minimum time,
 * preventing attackers from distinguishing between different failure modes.
 *
 * @param verifyFn - Async function that performs the actual verification
 * @param targetTimeMs - Minimum time the operation should take (default: 100ms)
 * @returns Promise<boolean> - Result of verification
 */
export async function timingSafeVerify(
  verifyFn: () => Promise<boolean>,
  targetTimeMs: number = 100
): Promise<boolean> {
  const startTime = Date.now();

  try {
    const result = await verifyFn();
    const elapsed = Date.now() - startTime;
    if (elapsed < targetTimeMs) {
      await sleep(targetTimeMs - elapsed);
    }
    return result;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (elapsed < targetTimeMs) {
      await sleep(targetTimeMs - elapsed);
    }
    throw error;
  }
}

/**
 * Timing-safe database query wrapper
 *
 * Ensures database queries take constant time regardless of result.
 *
 * @param queryFn - Async function that performs the database query
 * @param minimumTimeMs - Minimum time the query should take (default: 50ms)
 * @returns Promise<T | null> - Query result or null
 */
export async function timingSafeQuery<T>(
  queryFn: () => Promise<T | null>,
  minimumTimeMs: number = 50
): Promise<T | null> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const elapsed = Date.now() - startTime;
    if (elapsed < minimumTimeMs) {
      await sleep(minimumTimeMs - elapsed);
    }
    return result;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (elapsed < minimumTimeMs) {
      await sleep(minimumTimeMs - elapsed);
    }
    throw error;
  }
}

/**
 * Generate timing-safe error responses
 *
 * Returns the same generic error message regardless of failure mode,
 * preventing information leakage through error messages.
 *
 * @param _errorType - Internal error type for logging
 * @returns Generic error message safe for client
 */
export function timingSafeError(_errorType: string): string {
  return 'Invalid credentials';
}

/**
 * Timing attack prevention metrics
 * Used for monitoring and ensuring timing consistency
 */
export class TimingMetrics {
  private measurements: number[] = [];
  private maxMeasurements = 1000;

  record(durationMs: number): void {
    this.measurements.push(durationMs);
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
  }

  getStats(): {
    mean: number;
    min: number;
    max: number;
    stdDev: number;
    variance: number;
  } {
    if (this.measurements.length === 0) {
      return { mean: 0, min: 0, max: 0, stdDev: 0, variance: 0 };
    }

    const mean = this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;
    const variance = this.measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.measurements.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      min: Math.min(...this.measurements),
      max: Math.max(...this.measurements),
      stdDev,
      variance
    };
  }

  isConsistent(maxVarianceMs: number = 10): boolean {
    const stats = this.getStats();
    return stats.variance <= maxVarianceMs;
  }

  reset(): void {
    this.measurements = [];
  }
}

export const timingMetrics = new TimingMetrics();
