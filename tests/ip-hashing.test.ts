/**
 * IP Hashing Unit Tests + Property-Based Testing
 *
 * Tests for:
 *   - Deterministic hashing (same IP -> same hash)
 *   - Different IPs -> different hashes
 *   - Hash format validation (16 hex chars)
 *   - IP masking
 *   - Salt generation
 *   - PBT: deterministic for same input, different for different inputs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { test as fcTest } from '@fast-check/vitest';
import fc from 'fast-check';
import { hashIp, maskIp, isValidIpHash, generateSalt } from '../src/ipHashing.js';
import { configureSecurity, resetSecurityConfig } from '../src/config.js';

// ============================================================================
// Test helpers
// ============================================================================

const TEST_SALT = 'test-salt-for-ip-hashing-unit-tests-32bytes!!';

function setupTestConfig(salt: string = TEST_SALT): void {
  configureSecurity({
    config: {
      ipHashSalt: salt,
      nodeEnv: 'test',
    },
  });
}

// ============================================================================
// Arbitraries for PBT
// ============================================================================

const ipv4Arb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// ============================================================================
// Unit Tests
// ============================================================================

describe('IP Hashing', () => {
  beforeEach(() => {
    setupTestConfig();
  });

  afterEach(() => {
    resetSecurityConfig();
  });

  describe('hashIp', () => {
    it('should return a consistent hash for the same IP', () => {
      const hash1 = hashIp('192.168.1.1');
      const hash2 = hashIp('192.168.1.1');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different IPs', () => {
      const hash1 = hashIp('192.168.1.1');
      const hash2 = hashIp('192.168.1.2');
      expect(hash1).not.toBe(hash2);
    });

    it('should return a 16-character hexadecimal string', () => {
      const hash = hashIp('10.0.0.1');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
      expect(hash.length).toBe(16);
    });

    it('should handle IPv6 addresses', () => {
      const hash = hashIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should handle localhost', () => {
      const hash = hashIp('127.0.0.1');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should produce different hashes with different salts', () => {
      const hash1 = hashIp('192.168.1.1');

      resetSecurityConfig();
      setupTestConfig('different-salt-for-comparison');

      const hash2 = hashIp('192.168.1.1');
      expect(hash1).not.toBe(hash2);
    });

    it('should fallback to 0.0.0.0 for invalid input', () => {
      const hashEmpty = hashIp('');
      const hashNull = hashIp(null as unknown as string);
      const hashUndefined = hashIp(undefined as unknown as string);

      // All invalid inputs should resolve to the same fallback hash
      expect(hashEmpty).toBe(hashNull);
      expect(hashNull).toBe(hashUndefined);
      expect(hashEmpty).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('maskIp', () => {
    it('should mask the last two octets of IPv4 addresses', () => {
      expect(maskIp('192.168.1.100')).toBe('192.168.*.*');
      expect(maskIp('10.0.0.1')).toBe('10.0.*.*');
      expect(maskIp('127.0.0.1')).toBe('127.0.*.*');
    });

    it('should return non-IPv4 addresses unchanged', () => {
      // The implementation only handles IPv4 (4-part dotted)
      expect(maskIp('2001:db8::1')).toBe('2001:db8::1');
    });
  });

  describe('isValidIpHash', () => {
    it('should accept valid 16-char hex strings', () => {
      expect(isValidIpHash('abcdef0123456789')).toBe(true);
      expect(isValidIpHash('0000000000000000')).toBe(true);
      expect(isValidIpHash('ffffffffffffffff')).toBe(true);
    });

    it('should reject invalid hashes', () => {
      expect(isValidIpHash('')).toBe(false);
      expect(isValidIpHash('short')).toBe(false);
      expect(isValidIpHash('ABCDEF0123456789')).toBe(false); // uppercase
      expect(isValidIpHash('abcdef012345678g')).toBe(false); // non-hex
      expect(isValidIpHash('abcdef01234567890')).toBe(false); // too long
    });
  });

  describe('generateSalt', () => {
    it('should return a 64-character hex string', () => {
      const salt = generateSalt();
      expect(salt).toMatch(/^[a-f0-9]{64}$/);
      expect(salt.length).toBe(64);
    });

    it('should generate unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('PBT: IP hashing invariants', () => {
  beforeEach(() => {
    setupTestConfig();
  });

  afterEach(() => {
    resetSecurityConfig();
  });

  fcTest.prop([ipv4Arb])(
    'hashIp is deterministic: same input always produces same output',
    (ip) => {
      const hash1 = hashIp(ip);
      const hash2 = hashIp(ip);
      expect(hash1).toBe(hash2);
    }
  );

  fcTest.prop([ipv4Arb])(
    'hashIp always produces a valid 16-char hex string',
    (ip) => {
      const hash = hashIp(ip);
      expect(isValidIpHash(hash)).toBe(true);
    }
  );

  fcTest.prop([ipv4Arb, ipv4Arb])(
    'different IPs produce different hashes (with high probability)',
    (ip1, ip2) => {
      // Only assert when IPs are actually different
      fc.pre(ip1 !== ip2);
      const hash1 = hashIp(ip1);
      const hash2 = hashIp(ip2);
      expect(hash1).not.toBe(hash2);
    }
  );

  fcTest.prop([
    fc.string({ minLength: 8, maxLength: 64 }),
    fc.string({ minLength: 8, maxLength: 64 }),
  ])(
    'different salts produce different hashes for the same IP',
    (salt1, salt2) => {
      fc.pre(salt1 !== salt2);

      resetSecurityConfig();
      setupTestConfig(salt1);
      const hash1 = hashIp('192.168.1.1');

      resetSecurityConfig();
      setupTestConfig(salt2);
      const hash2 = hashIp('192.168.1.1');

      expect(hash1).not.toBe(hash2);
    }
  );

  fcTest.prop([fc.string({ minLength: 1, maxLength: 200 })])(
    'hashIp never throws for arbitrary string input',
    (input) => {
      expect(() => hashIp(input)).not.toThrow();
      const hash = hashIp(input);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(16);
    }
  );
});
