import { resolveAuthUser } from '../_lib/auth.js';
import { applyCors, type HttpReq, type HttpRes } from '../_lib/http.js';

export default async function handler(req: HttpReq, res: HttpRes) {
  applyCors(res);

  if (req.method === 'OPTIONS') return res.status(204).send();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  try {
    const user = await resolveAuthUser(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    return res.status(200).json({ user });
  } catch (err) {
    console.error('GET /api/auth/me failed', err);
    return res.status(500).json({ error: 'internal server error' });
  }
}