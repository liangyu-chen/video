import bcrypt from 'bcryptjs';

import { findUserByEmail } from '../_lib/db.js';
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

  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'invalid credentials' });

    const token = signJwt(user.email, user.id);
    return res.status(200).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('POST /api/auth/login failed', err);
    return res.status(500).json({ error: 'internal server error' });
  }
}