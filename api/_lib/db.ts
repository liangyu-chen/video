import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

export const pool = new Pool({ connectionString });

export type VideoRecord = {
  id: string;
  url: string;
  title: string;
  tags: string[];
  category: string;
  thumbnailUrl?: string;
  createdAt: number;
};

type VideoRow = {
  id: string;
  url: string;
  title: string;
  tags: string[];
  category: string;
  thumbnail_url: string | null;
  created_at: string | number;
};

function toRecord(row: VideoRow): VideoRecord {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    tags: Array.isArray(row.tags) ? row.tags : [],
    category: row.category,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    createdAt: Number(row.created_at),
  };
}

export async function listVideos(): Promise<VideoRecord[]> {
  const { rows } = await pool.query<VideoRow>(
    'SELECT id, url, title, tags, category, thumbnail_url, created_at FROM videos ORDER BY created_at DESC',
  );
  return rows.map(toRecord);
}

export async function findVideoByUrl(url: string): Promise<VideoRecord | null> {
  const { rows } = await pool.query<VideoRow>(
    'SELECT id, url, title, tags, category, thumbnail_url, created_at FROM videos WHERE url = $1 LIMIT 1',
    [url],
  );
  return rows.length > 0 ? toRecord(rows[0]) : null;
}

export async function insertVideo(input: {
  id: string;
  url: string;
  title: string;
  tags: string[];
  category: string;
  thumbnailUrl?: string;
  createdAt: number;
}): Promise<VideoRecord> {
  const { rows } = await pool.query<VideoRow>(
    `INSERT INTO videos (id, url, title, tags, category, thumbnail_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, url, title, tags, category, thumbnail_url, created_at`,
    [
      input.id,
      input.url,
      input.title,
      input.tags,
      input.category,
      input.thumbnailUrl ?? null,
      input.createdAt,
    ],
  );
  return toRecord(rows[0]);
}

export async function deleteVideo(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM videos WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}