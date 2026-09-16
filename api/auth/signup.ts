import bcrypt from 'bcryptjs';

import { createUser, findUserByEmail } from '../_lib/db.js';
import { signJwt } from '../_lib/auth.js';
import { applyCors, isXApiKeyOk, type HttpReq, type HttpRes } from '../_lib/http.js';

export default async function handler(req: HttpReq, res: HttpRes) {
  applyCors(res);

  if (req.method === 'OPTIONS') return res.status(204).send();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!isXApiKeyOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'password too short (min 6)' });

  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const user = await createUser(email, hash);
    const token = signJwt(user.email, user.id);
    return res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('POST /api/auth/signup failed', err);
    return res.status(500).json({ error: 'internal server error' });
  }
}