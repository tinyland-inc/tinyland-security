








interface CookieSerializeOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
  maxAge?: number;
  domain?: string;
  expires?: Date;
}

export const SECURE_COOKIE_OPTIONS: CookieSerializeOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/'
} as const;

export const SESSION_COOKIE_OPTIONS: CookieSerializeOptions = {
  ...SECURE_COOKIE_OPTIONS,
  maxAge: 60 * 60 * 24 * 7
} as const;

export const TEMP_COOKIE_OPTIONS: CookieSerializeOptions = {
  ...SECURE_COOKIE_OPTIONS,
  maxAge: 300
} as const;

export const BOOTSTRAP_COOKIE_OPTIONS: CookieSerializeOptions = {
  ...SECURE_COOKIE_OPTIONS,
  path: '/admin/bootstrap',
  maxAge: 600
} as const;

export const AUTH_DATA_COOKIE_OPTIONS: CookieSerializeOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7
} as const;

export const DELETE_COOKIE_OPTIONS: CookieSerializeOptions = {
  path: '/',
  maxAge: 0
} as const;

export function createDeleteOptions(path: string): CookieSerializeOptions {
  return { path, maxAge: 0 };
}
