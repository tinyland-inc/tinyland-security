/**
 * IP Ban Management
 *
 * In-memory IP ban list with file-backed persistence.
 * For production use, consider a database-backed implementation.
 *
 * @module ipBans
 */

import { promises as fs } from 'fs';
import path from 'path';

interface IpBan {
  id: string;
  ip_address: string;
  ip_range_start?: string;
  ip_range_end?: string;
  reason?: string;
  banned_by?: string;
  banned_at: string;
  expires_at?: string;
  is_active: boolean;
}

/**
 * Options for configuring the IP ban storage location
 */
export interface IpBanStoreOptions {
  storageDir?: string;
}

let SECURITY_DIR = path.join(process.cwd(), 'content', 'security');
let IP_BANS_FILE = path.join(SECURITY_DIR, 'ip-bans.json');

/**
 * Configure the storage location for IP bans
 */
export function configureIpBanStore(options: IpBanStoreOptions): void {
  if (options.storageDir) {
    SECURITY_DIR = options.storageDir;
    IP_BANS_FILE = path.join(SECURITY_DIR, 'ip-bans.json');
  }
}

async function ensureFile(): Promise<void> {
  try {
    await fs.mkdir(SECURITY_DIR, { recursive: true });
    await fs.access(IP_BANS_FILE);
  } catch {
    await fs.writeFile(IP_BANS_FILE, '[]', 'utf8');
  }
}

async function readBans(): Promise<IpBan[]> {
  await ensureFile();
  try {
    const content = await fs.readFile(IP_BANS_FILE, 'utf8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      console.warn('IP bans file contains invalid data (not an array), resetting to empty array');
      await fs.writeFile(IP_BANS_FILE, '[]', 'utf8');
      return [];
    }
    return parsed;
  } catch {
    await fs.writeFile(IP_BANS_FILE, '[]', 'utf8');
    return [];
  }
}

async function writeBans(bans: IpBan[]): Promise<void> {
  await fs.writeFile(IP_BANS_FILE, JSON.stringify(bans, null, 2), 'utf8');
}

export async function isIpBanned(ipAddress: string): Promise<boolean> {
  try {
    const bans = await readBans();
    const now = new Date();
    return bans.some(ban => {
      if (!ban.is_active) return false;
      if (ban.expires_at && new Date(ban.expires_at) < now) return false;
      if (ban.ip_address === ipAddress) return true;
      if (ban.ip_range_start && ban.ip_range_end) {
        return ipAddress >= ban.ip_range_start && ipAddress <= ban.ip_range_end;
      }
      return false;
    });
  } catch {
    return false;
  }
}

export async function addIpBan(
  ipAddress: string,
  options?: {
    reason?: string;
    bannedBy?: string;
    expiresAt?: Date;
    ipRangeStart?: string;
    ipRangeEnd?: string;
  }
): Promise<void> {
  const bans = await readBans();
  const newBan: IpBan = {
    id: crypto.randomUUID(),
    ip_address: ipAddress,
    ip_range_start: options?.ipRangeStart,
    ip_range_end: options?.ipRangeEnd,
    reason: options?.reason,
    banned_by: options?.bannedBy,
    banned_at: new Date().toISOString(),
    expires_at: options?.expiresAt?.toISOString(),
    is_active: true
  };
  bans.push(newBan);
  await writeBans(bans);
}

export async function removeIpBan(ipAddress: string): Promise<void> {
  const bans = await readBans();
  const filteredBans = bans.filter(ban => ban.ip_address !== ipAddress);
  await writeBans(filteredBans);
}

export async function deactivateIpBan(ipAddress: string): Promise<void> {
  const bans = await readBans();
  const ban = bans.find(b => b.ip_address === ipAddress);
  if (ban) {
    ban.is_active = false;
    await writeBans(bans);
  }
}

export async function getActiveBans(): Promise<IpBan[]> {
  const bans = await readBans();
  const now = new Date();
  return bans.filter(ban => {
    if (!ban.is_active) return false;
    if (ban.expires_at && new Date(ban.expires_at) < now) return false;
    return true;
  });
}

export async function cleanupExpiredBans(): Promise<number> {
  const bans = await readBans();
  const now = new Date();
  const activeBans = bans.filter(ban => {
    if (!ban.expires_at) return true;
    return new Date(ban.expires_at) >= now;
  });
  const removedCount = bans.length - activeBans.length;
  if (removedCount > 0) {
    await writeBans(activeBans);
  }
  return removedCount;
}
