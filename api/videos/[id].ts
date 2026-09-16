import { deleteVideo } from '../_lib/db';

type Req = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
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

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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

  const id = single(req.query.id);
  if (!id || id.length === 0) {
    return res.status(400).json({ error: 'missing id' });
  }

  try {
    if (req.method === 'DELETE') {
      const deleted = await deleteVideo(id);
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