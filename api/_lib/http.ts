export type HttpReq = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

export type HttpRes = {
  setHeader(name: string, value: string): void;
  status(code: number): HttpRes;
  json(body: unknown): void;
  send(body?: unknown): void;
};

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
};

export function applyCors(res: HttpRes): void {
  res.setHeader('Access-Control-Allow-Origin', CORS_HEADERS['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);
}

export function isXApiKeyOk(req: HttpReq): boolean {
  const expected = process.env.API_KEY;
  if (!expected) return true;
  const provided = req.headers['x-api-key'];
  return provided === expected;
}