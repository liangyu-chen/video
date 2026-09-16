import { pingDatabase } from './_lib/db';

type Req = {
  method?: string;
};

type Res = {
  setHeader(name: string, value: string): void;
  status(code: number): Res;
  json(body: unknown): void;
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

export default async function handler(_req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_HEADERS['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);

  try {
    const connected = await pingDatabase();
    return res.status(200).json({
      ok: true,
      service: 'clipkeeper-server',
      db: connected ? 'connected' : 'not_configured',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return res.status(200).json({
      ok: true,
      service: 'clipkeeper-server',
      db: 'error',
      detail: message,
    });
  }
}