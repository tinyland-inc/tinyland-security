












import { describe, it, expect } from 'vitest';
import { test as fcTest } from '@fast-check/vitest';
import fc from 'fast-check';
import {
  constantTimeCompare,
  timingSafeVerify,
  timingSafeQuery,
  timingSafeError,
  TimingMetrics,
} from '../src/timingSafe.js';





describe('constantTimeCompare', () => {
  describe('equal strings', () => {
    it('should return true for identical strings', () => {
      expect(constantTimeCompare('abc123', 'abc123')).toBe(true);
    });

    it('should return true for empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true);
    });

    it('should return true for single character', () => {
      expect(constantTimeCompare('x', 'x')).toBe(true);
    });

    it('should return true for long identical strings', () => {
      const long = 'a'.repeat(10_000);
      expect(constantTimeCompare(long, long)).toBe(true);
    });

    it('should return true for strings with special characters', () => {
      const special = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      expect(constantTimeCompare(special, special)).toBe(true);
    });

    it('should return true for unicode strings', () => {
      const unicode = '\u{1F600}\u{1F601}\u{1F602}';
      expect(constantTimeCompare(unicode, unicode)).toBe(true);
    });
  });

  describe('different strings', () => {
    it('should return false for different strings of same length', () => {
      expect(constantTimeCompare('abc123', 'abc124')).toBe(false);
    });

    it('should return false for strings differing in first character', () => {
      expect(constantTimeCompare('abc', 'xbc')).toBe(false);
    });

    it('should return false for strings differing in last character', () => {
      expect(constantTimeCompare('abc', 'abd')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(constantTimeCompare('ABC', 'abc')).toBe(false);
    });
  });

  describe('different lengths', () => {
    it('should return false when first string is shorter', () => {
      expect(constantTimeCompare('abc', 'abcdef')).toBe(false);
    });

    it('should return false when second string is shorter', () => {
      expect(constantTimeCompare('abcdef', 'abc')).toBe(false);
    });

    it('should return false for empty vs non-empty', () => {
      expect(constantTimeCompare('', 'x')).toBe(false);
      expect(constantTimeCompare('x', '')).toBe(false);
    });
  });
});





describe('timingSafeVerify', () => {
  it('should return the result of the verify function', async () => {
    const result = await timingSafeVerify(async () => true, 10);
    expect(result).toBe(true);
  });

  it('should return false when verify function returns false', async () => {
    const result = await timingSafeVerify(async () => false, 10);
    expect(result).toBe(false);
  });

  it('should take at least the target time', async () => {
    const targetMs = 50;
    const start = Date.now();
    await timingSafeVerify(async () => true, targetMs);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(targetMs - 10);
  });

  it('should propagate errors after waiting', async () => {
    const error = new Error('verification failed');
    await expect(
      timingSafeVerify(async () => {
        throw error;
      }, 10)
    ).rejects.toThrow('verification failed');
  });
});





describe('timingSafeQuery', () => {
  it('should return query result', async () => {
    const result = await timingSafeQuery(async () => ({ id: 1, name: 'test' }), 10);
    expect(result).toEqual({ id: 1, name: 'test' });
  });

  it('should return null when query returns null', async () => {
    const result = await timingSafeQuery(async () => null, 10);
    expect(result).toBeNull();
  });

  it('should take at least the minimum time', async () => {
    const minMs = 50;
    const start = Date.now();
    await timingSafeQuery(async () => 'fast', minMs);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(minMs - 10);
  });

  it('should propagate errors after waiting', async () => {
    await expect(
      timingSafeQuery(async () => {
        throw new Error('db error');
      }, 10)
    ).rejects.toThrow('db error');
  });
});





describe('timingSafeError', () => {
  it('should return a generic error message regardless of input', () => {
    expect(timingSafeError('invalid_password')).toBe('Invalid credentials');
    expect(timingSafeError('user_not_found')).toBe('Invalid credentials');
    expect(timingSafeError('account_locked')).toBe('Invalid credentials');
    expect(timingSafeError('')).toBe('Invalid credentials');
  });

  it('should never leak the internal error type', () => {
    const result = timingSafeError('super_secret_internal_error');
    expect(result).not.toContain('super_secret');
    expect(result).not.toContain('internal');
  });
});





describe('TimingMetrics', () => {
  it('should start with zero stats', () => {
    const metrics = new TimingMetrics();
    const stats = metrics.getStats();
    expect(stats.mean).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.stdDev).toBe(0);
    expect(stats.variance).toBe(0);
  });

  it('should track recorded measurements', () => {
    const metrics = new TimingMetrics();
    metrics.record(100);
    metrics.record(200);
    metrics.record(300);

    const stats = metrics.getStats();
    expect(stats.mean).toBe(200);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(300);
  });

  it('should calculate standard deviation', () => {
    const metrics = new TimingMetrics();
    metrics.record(10);
    metrics.record(10);
    metrics.record(10);

    const stats = metrics.getStats();
    expect(stats.stdDev).toBe(0);
    expect(stats.variance).toBe(0);
  });

  it('should report consistency based on variance threshold', () => {
    const metrics = new TimingMetrics();
    metrics.record(100);
    metrics.record(100);
    metrics.record(100);
    expect(metrics.isConsistent(1)).toBe(true);

    metrics.reset();
    metrics.record(1);
    metrics.record(1000);
    expect(metrics.isConsistent(1)).toBe(false);
  });

  it('should reset measurements', () => {
    const metrics = new TimingMetrics();
    metrics.record(100);
    metrics.record(200);
    metrics.reset();

    const stats = metrics.getStats();
    expect(stats.mean).toBe(0);
  });

  it('should evict old measurements when exceeding max', () => {
    const metrics = new TimingMetrics();
    
    for (let i = 0; i < 1001; i++) {
      metrics.record(i);
    }

    const stats = metrics.getStats();
    
    expect(stats.min).toBe(1);
  });
});





describe('PBT: Timing-safe comparison invariants', () => {
  fcTest.prop([fc.string()])(
    'any string compared to itself should return true',
    (s) => {
      expect(constantTimeCompare(s, s)).toBe(true);
    }
  );

  fcTest.prop([fc.string(), fc.string()])(
    'comparison result matches regular equality',
    (a, b) => {
      const timingSafeResult = constantTimeCompare(a, b);
      const regularResult = a === b;
      expect(timingSafeResult).toBe(regularResult);
    }
  );

  fcTest.prop([fc.string(), fc.string()])(
    'comparison is symmetric: compare(a, b) === compare(b, a)',
    (a, b) => {
      expect(constantTimeCompare(a, b)).toBe(constantTimeCompare(b, a));
    }
  );

  fcTest.prop([fc.string({ minLength: 1 })])(
    'a string is never equal to itself with an appended character',
    (s) => {
      expect(constantTimeCompare(s, s + 'x')).toBe(false);
    }
  );

  fcTest.prop([fc.string()])(
    'timingSafeError never returns the input',
    (errorType) => {
      const result = timingSafeError(errorType);
      expect(result).toBe('Invalid credentials');
      
      if (errorType.length > 0 && !('Invalid credentials'.includes(errorType))) {
        expect(result).not.toContain(errorType);
      }
    }
  );
});
