












import { timingSafeEqual } from 'crypto';





async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}











export function constantTimeCompare(a: string, b: string): boolean {
  
  
  const maxLength = Math.max(a.length, b.length);

  
  const paddedA = a.padEnd(maxLength, '\0');
  const paddedB = b.padEnd(maxLength, '\0');

  
  const bufA = Buffer.from(paddedA, 'utf-8');
  const bufB = Buffer.from(paddedB, 'utf-8');

  try {
    
    
    return timingSafeEqual(bufA, bufB);
  } catch {
    
    
    return false;
  }
}











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










export function timingSafeError(_errorType: string): string {
  return 'Invalid credentials';
}





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
