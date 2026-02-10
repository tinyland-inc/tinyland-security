/**
 * Device Detection Unit Tests
 *
 * Tests for:
 *   - Mobile device classification
 *   - Tablet device classification
 *   - Desktop device classification
 *   - Bot/empty UA handling
 *   - Browser info extraction (Chrome, Firefox, Safari, Edge, Opera)
 *   - OS info extraction (Windows, macOS, iOS, Android, Linux)
 */

import { describe, it, expect } from 'vitest';
import { detectDeviceType, extractBrowserInfo, extractOSInfo } from '../src/deviceDetection.js';

// ============================================================================
// Real-world User-Agent strings
// ============================================================================

const USER_AGENTS = {
  // Desktop browsers
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefoxLinux:
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  operaWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',

  // Mobile devices
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  androidMobile:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
  windowsPhone:
    'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15254',

  // Tablets
  ipad:
    'Mozilla/5.0 (iPad; CPU OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Safari/537.36',
  kindle:
    'Mozilla/5.0 (Linux; Android 4.4.3; KFTHWI Build/KTU84M) AppleWebKit/537.36 (KHTML, like Gecko) Silk/3.67 like Chrome/39.0.2171.93 Safari/537.36',
  playbook:
    'Mozilla/5.0 (PlayBook; U; RIM Tablet OS 2.1.0; en-US) AppleWebKit/536.2+ (KHTML, like Gecko) Version/7.2.1.0 Safari/536.2+',

  // Bots / empty
  googlebot:
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  empty: '',
};

// ============================================================================
// Device Type Detection
// ============================================================================

describe('detectDeviceType', () => {
  describe('mobile devices', () => {
    it('should detect iPhone as mobile', () => {
      expect(detectDeviceType(USER_AGENTS.iphone)).toBe('mobile');
    });

    it('should detect Android phone as mobile', () => {
      expect(detectDeviceType(USER_AGENTS.androidMobile)).toBe('mobile');
    });

    it('should detect Windows Phone as mobile', () => {
      expect(detectDeviceType(USER_AGENTS.windowsPhone)).toBe('mobile');
    });
  });

  describe('tablet devices', () => {
    it('should detect iPad as tablet', () => {
      expect(detectDeviceType(USER_AGENTS.ipad)).toBe('tablet');
    });

    it('should detect Android tablet as tablet', () => {
      // Android tablet UAs typically lack "mobile"
      expect(detectDeviceType(USER_AGENTS.androidTablet)).toBe('tablet');
    });

    it('should detect Kindle as tablet', () => {
      expect(detectDeviceType(USER_AGENTS.kindle)).toBe('tablet');
    });

    it('should detect PlayBook as tablet', () => {
      expect(detectDeviceType(USER_AGENTS.playbook)).toBe('tablet');
    });
  });

  describe('desktop devices', () => {
    it('should detect Chrome on Windows as desktop', () => {
      expect(detectDeviceType(USER_AGENTS.chromeWindows)).toBe('desktop');
    });

    it('should detect Firefox on Linux as desktop', () => {
      expect(detectDeviceType(USER_AGENTS.firefoxLinux)).toBe('desktop');
    });

    it('should detect Safari on macOS as desktop', () => {
      expect(detectDeviceType(USER_AGENTS.safariMac)).toBe('desktop');
    });

    it('should detect Edge on Windows as desktop', () => {
      expect(detectDeviceType(USER_AGENTS.edgeWindows)).toBe('desktop');
    });
  });

  describe('edge cases', () => {
    it('should return unknown for empty user agent', () => {
      expect(detectDeviceType('')).toBe('unknown');
    });

    it('should return desktop for bot user agents', () => {
      // Bots don't match mobile/tablet patterns, so they fall through to desktop
      expect(detectDeviceType(USER_AGENTS.googlebot)).toBe('desktop');
    });

    it('should return unknown for undefined-like input', () => {
      expect(detectDeviceType(undefined as unknown as string)).toBe('unknown');
      expect(detectDeviceType(null as unknown as string)).toBe('unknown');
    });
  });
});

// ============================================================================
// Browser Info Extraction
// ============================================================================

describe('extractBrowserInfo', () => {
  it('should detect Chrome', () => {
    const info = extractBrowserInfo(USER_AGENTS.chromeWindows);
    expect(info.name).toBe('Chrome');
    expect(info.version).toMatch(/^\d+/);
  });

  it('should detect Firefox', () => {
    const info = extractBrowserInfo(USER_AGENTS.firefoxLinux);
    expect(info.name).toBe('Firefox');
    expect(info.version).toMatch(/^\d+/);
  });

  it('should detect Safari (not Chrome)', () => {
    const info = extractBrowserInfo(USER_AGENTS.safariMac);
    expect(info.name).toBe('Safari');
    expect(info.version).toMatch(/^\d+/);
  });

  it('should detect Edge (not Chrome)', () => {
    const info = extractBrowserInfo(USER_AGENTS.edgeWindows);
    expect(info.name).toBe('Edge');
    expect(info.version).toMatch(/^\d+/);
  });

  it('should detect Opera', () => {
    const info = extractBrowserInfo(USER_AGENTS.operaWindows);
    expect(info.name).toBe('Opera');
    expect(info.version).toMatch(/^\d+/);
  });

  it('should return unknown for unrecognized UA', () => {
    const info = extractBrowserInfo('custom-agent/1.0');
    expect(info.name).toBe('unknown');
    expect(info.version).toBe('unknown');
  });

  it('should return unknown for empty string', () => {
    const info = extractBrowserInfo('');
    expect(info.name).toBe('unknown');
    expect(info.version).toBe('unknown');
  });
});

// ============================================================================
// OS Info Extraction
// ============================================================================

describe('extractOSInfo', () => {
  it('should detect Windows 10/11', () => {
    const info = extractOSInfo(USER_AGENTS.chromeWindows);
    expect(info.name).toBe('Windows');
    expect(info.version).toBe('10/11');
  });

  it('should detect macOS with version', () => {
    const info = extractOSInfo(USER_AGENTS.safariMac);
    expect(info.name).toBe('macOS');
    expect(info.version).toMatch(/^\d+\.\d+/);
  });

  it('should detect iOS from iPhone UA', () => {
    const info = extractOSInfo(USER_AGENTS.iphone);
    expect(info.name).toBe('iOS');
    expect(info.version).toMatch(/^\d+/);
  });

  it('should detect iOS from iPad UA', () => {
    const info = extractOSInfo(USER_AGENTS.ipad);
    expect(info.name).toBe('iOS');
  });

  it('should detect Android with version', () => {
    const info = extractOSInfo(USER_AGENTS.androidMobile);
    expect(info.name).toBe('Android');
    expect(info.version).toMatch(/^\d+/);
  });

  it('should detect Linux', () => {
    const info = extractOSInfo(USER_AGENTS.firefoxLinux);
    expect(info.name).toBe('Linux');
  });

  it('should return unknown for unrecognized UA', () => {
    const info = extractOSInfo('custom-agent/1.0');
    expect(info.name).toBe('unknown');
    expect(info.version).toBe('unknown');
  });

  it('should return unknown for empty string', () => {
    const info = extractOSInfo('');
    expect(info.name).toBe('unknown');
    expect(info.version).toBe('unknown');
  });
});
