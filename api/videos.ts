import {
  findVideoByUrl,
  insertVideo,
  listVideos,
  type VideoInput,
} from './_lib/db.js';
import { getAuthUserId } from './_lib/auth.js';
import { applyCors, isXApiKeyOk, type HttpReq, type HttpRes } from './_lib/http.js';

function detectSource(url: string): string {
  return /youtu\.?be/i.test(url) ? 'youtube' : 'instagram';
}

function parseVideo(body: unknown): VideoInput | string {
  if (typeof body !== 'object' || body === null) return 'invalid body';
  const b = body as Record<string, unknown>;
  if (typeof b.url !== 'string' || b.url.length === 0) return 'missing url';
  if (typeof b.title !== 'string') return 'missing title';
  if (typeof b.category !== 'string') return 'missing category';
  const tags = Array.isArray(b.tags)
    ? b.tags.filter((t): t is string => typeof t === 'string')
    : [];
  const thumbnailUrl = typeof b.thumbnailUrl === 'string' ? b.thumbnailUrl : undefined;
  const createdAt =
    typeof b.createdAt === 'number' && Number.isFinite(b.createdAt) ? b.createdAt : Date.now();
  return {
    url: b.url,
    sourceType: detectSource(b.url),
    title: b.title,
    tags,
    category: b.category,
    thumbnailUrl,
    createdAt,
  };
}

export default async function handler(req: HttpReq, res: HttpRes) {
  applyCors(res);

  if (req.method === 'OPTIONS') return res.status(204).send();
  if (!isXApiKeyOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const userId = getAuthUserId(req);
  if (userId === null) return res.status(401).json({ error: 'unauthorized' });

  try {
    if (req.method === 'GET') {
      const videos = await listVideos(userId);
      return res.status(200).json({ videos });
    }

    if (req.method === 'POST') {
      const parsed = parseVideo(req.body);
      if (typeof parsed === 'string') {
        return res.status(400).json({ error: parsed });
      }
      const existing = await findVideoByUrl(parsed.url, userId);
      if (existing) {
        return res.status(409).json({ error: 'duplicate url', existing });
      }
      const created = await insertVideo(parsed, userId);
      return res.status(201).json({ video: created });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('GET/POST /api/videos failed', err);
    const message = err instanceof Error ? err.message : 'internal server error';
    return res.status(500).json({ error: message });
  }
}