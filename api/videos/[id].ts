import { deleteVideo } from '../_lib/db.js';
import { getAuthUserId } from '../_lib/auth.js';
import { applyCors, isXApiKeyOk, type HttpReq, type HttpRes } from '../_lib/http.js';

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: HttpReq, res: HttpRes) {
  applyCors(res);

  if (req.method === 'OPTIONS') return res.status(204).send();
  if (!isXApiKeyOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const userId = getAuthUserId(req);
  if (userId === null) return res.status(401).json({ error: 'unauthorized' });

  const id = single(req.query?.id);
  if (!id || id.length === 0) return res.status(400).json({ error: 'missing id' });

  try {
    if (req.method === 'DELETE') {
      const numId = Number(id);
      if (!Number.isInteger(numId)) {
        return res.status(400).json({ error: 'invalid id' });
      }
      const deleted = await deleteVideo(numId, userId);
      return deleted
        ? res.status(204).send()
        : res.status(404).json({ error: 'not found' });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(`DELETE /api/videos/${id} failed`, err);
    const message = err instanceof Error ? err.message : 'internal server error';
    return res.status(500).json({ error: message });
  }
}