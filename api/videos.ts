import {
  findVideoByUrl,
  insertVideo,
  listVideos,
  type VideoRecord,
} from './_lib/db';

type Req = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type Res = {
  setHeader(name: string, value: string): void;
  status(code: number): Res;
  json(body: unknown): void;
  send(body?: unknown): void;
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

function isAuthorized(req: Req): boolean {
  const expected = process.env.API_KEY;
  if (!expected) return true;
  const provided = req.headers['x-api-key'];
  return provided === expected;
}

function validateVideo(body: unknown): VideoRecord | string {
  if (typeof body !== 'object' || body === null) return 'invalid body';
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || b.id.length === 0) return 'missing id';
  if (typeof b.url !== 'string' || b.url.length === 0) return 'missing url';
  if (typeof b.title !== 'string') return 'missing title';
  if (typeof b.category !== 'string') return 'missing category';
  const tags = Array.isArray(b.tags)
    ? b.tags.filter((t): t is string => typeof t === 'string')
    : [];
  const thumbnailUrl = typeof b.thumbnailUrl === 'string' ? b.thumbnailUrl : undefined;
  const createdAt =
    typeof b.createdAt === 'number' && Number.isFinite(b.createdAt)
      ? b.createdAt
      : Date.now();
  return {
    id: b.id,
    url: b.url,
    title: b.title,
    tags,
    category: b.category,
    thumbnailUrl,
    createdAt,
  };
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_HEADERS['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);

  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const videos = await listVideos();
      return res.status(200).json({ videos });
    }

    if (req.method === 'POST') {
      const parsed = validateVideo(req.body);
      if (typeof parsed === 'string') {
        return res.status(400).json({ error: parsed });
      }
      const existing = await findVideoByUrl(parsed.url);
      if (existing) {
        return res.status(409).json({ error: 'duplicate url', existing });
      }
      const created = await insertVideo(parsed);
      return res.status(201).json({ video: created });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('GET/POST /api/videos failed', err);
    const message = err instanceof Error ? err.message : 'internal server error';
    return res.status(500).json({ error: message });
  }
}