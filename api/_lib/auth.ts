import { createHmac, timingSafeEqual } from 'node:crypto';

import { getUserById } from './db.js';

type JwtPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

type AuthUser = { id: number; email: string };

type ReqLike = {
  headers: Record<string, string | string[] | undefined>;
};

function base64urlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function hmac(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

function getSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  throw new Error('JWT_SECRET is not set');
}

export function signJwt(email: string, userId: number, ttlSeconds = 60 * 60 * 24 * 30): string {
  const secret = getSecret();
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(
    JSON.stringify({
      sub: String(userId),
      email,
      iat: now,
      exp: now + ttlSeconds,
    } as JwtPayload),
  );
  return `${header}.${payload}.${hmac(`${header}.${payload}`, secret)}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  const expected = hmac(`${header}.${payload}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(base64urlDecode(payload).toString('utf8')) as Partial<JwtPayload>;
    if (typeof decoded.sub !== 'string') return null;
    if (typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

export function getBearerToken(req: ReqLike): string | null {
  const header = req.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export function getAuthUserId(req: ReqLike): number | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  const id = Number(payload.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function resolveAuthUser(req: ReqLike): Promise<AuthUser | null> {
  const id = getAuthUserId(req);
  if (id === null) return null;
  const user = await getUserById(id);
  return user ?? null;
}