import { Pool, type PoolClient } from '@neondatabase/serverless';

type Queryable = Pool | PoolClient;

export type VideoRecord = {
  id: string;
  url: string;
  title: string;
  tags: string[];
  category: string;
  thumbnailUrl?: string;
  createdAt: number;
};

export type VideoInput = {
  url: string;
  sourceType: string;
  title: string;
  tags: string[];
  category: string;
  thumbnailUrl?: string;
  createdAt: number;
};

export type UserRecord = {
  id: number;
  email: string;
  password_hash: string;
};

type VideoRow = {
  id: number;
  source_url: string;
  source_type: string;
  title: string | null;
  summary: string | null;
  thumbnail_url: string | null;
  created_at: string | Date;
  category_name: string | null;
  tag_names: string[] | null;
};

const USER_ID = 1;

function createPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  return new Pool({ connectionString });
}

export const pool = createPool();

function requirePool(): Pool {
  if (!pool) throw new Error('DATABASE_URL is not set');
  return pool;
}

function toRecord(row: VideoRow): VideoRecord {
  return {
    id: String(row.id),
    url: row.source_url,
    title: row.title ?? '',
    tags: row.tag_names ?? [],
    category: row.category_name ?? 'unsorted',
    thumbnailUrl: row.thumbnail_url ?? undefined,
    createdAt: Math.floor(new Date(row.created_at).getTime()),
  };
}

const VIDEO_SELECT = `
  SELECT v.id, v.source_url, v.source_type, v.title, v.summary, v.thumbnail_url,
         v.created_at, c.name AS category_name,
         ARRAY_AGG(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL) AS tag_names
    FROM videos v
    LEFT JOIN categories c ON c.id = v.category_id
    LEFT JOIN video_tags vt ON vt.video_id = v.id
    LEFT JOIN tags t ON t.id = vt.tag_id
`;

export async function listVideos(userId: number = USER_ID): Promise<VideoRecord[]> {
  const { rows } = await requirePool().query<VideoRow>(
    `${VIDEO_SELECT}
      WHERE v.user_id = $1
      GROUP BY v.id, c.name
      ORDER BY v.created_at DESC`,
    [userId],
  );
  return rows.map(toRecord);
}

export async function findVideoByUrl(url: string, userId: number): Promise<VideoRecord | null> {
  const { rows } = await requirePool().query<VideoRow>(
    `${VIDEO_SELECT}
     WHERE v.source_url = $1 AND v.user_id = $2
     GROUP BY v.id, c.name
     LIMIT 1`,
    [url, userId],
  );
  return rows.length > 0 ? toRecord(rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { rows } = await requirePool().query<UserRecord>(
    'SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1',
    [email],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getUserById(id: number): Promise<Omit<UserRecord, 'password_hash'> | null> {
  const { rows } = await requirePool().query<Omit<UserRecord, 'password_hash'>>(
    'SELECT id, email FROM users WHERE id = $1 LIMIT 1',
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function createUser(
  email: string,
  passwordHash: string,
): Promise<Omit<UserRecord, 'password_hash'>> {
  const { rows } = await requirePool().query<Omit<UserRecord, 'password_hash'>>(
    'INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, now()) RETURNING id, email',
    [email, passwordHash],
  );
  return rows[0];
}

async function resolveCategory(
  name: string,
  db: Queryable,
  userId: number = USER_ID,
): Promise<number | null> {
  if (!name || name.length === 0) return null;
  const found = await db.query<{ id: number }>(
    'SELECT id FROM categories WHERE name = $1 ORDER BY (user_id = $2) DESC, user_id IS NULL DESC LIMIT 1',
    [name, userId],
  );
  if (found.rows.length > 0) return found.rows[0].id;
  const inserted = await db.query<{ id: number }>(
    'INSERT INTO categories (name, created_at, user_id) VALUES ($1, now(), $2) RETURNING id',
    [name, userId],
  );
  return inserted.rows[0].id;
}

async function ensureTagId(name: string, db: Queryable): Promise<number | null> {
  if (!name || name.length === 0) return null;
  await db.query(
    'INSERT INTO tags (name, created_at) VALUES ($1, now()) ON CONFLICT (name) DO NOTHING',
    [name],
  );
  const found = await db.query<{ id: number }>('SELECT id FROM tags WHERE name = $1', [name]);
  return found.rows.length > 0 ? found.rows[0].id : null;
}

async function linkTags(videoId: number, tags: string[], db: Queryable): Promise<void> {
  for (const name of tags) {
    const tagId = await ensureTagId(name, db);
    if (tagId) {
      await db.query(
        'INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [videoId, tagId],
      );
    }
  }
}

async function insertAnalysis(
  videoId: number,
  tags: string[],
  category: string,
  db: Queryable,
): Promise<void> {
  await db.query(
    `INSERT INTO analysis_results
       (video_id, provider, status, summary, categories, tags, objects, transcript, confidence, created_at, updated_at)
     VALUES ($1, $2, 'completed', NULL, to_json($3::text[]), to_json($4::text[]), '[]'::json, NULL, NULL, now(), now())`,
    [videoId, 'gemini-1.5-flash', category ? [category] : [], tags],
  );
}

export async function insertVideo(input: VideoInput, userId: number): Promise<VideoRecord> {
  const pool = requirePool();
  const createdAt = new Date(input.createdAt).toISOString();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const categoryId = await resolveCategory(input.category, client, userId);
    const inserted = await client.query<VideoRow>(
      `INSERT INTO videos
         (source_url, source_type, title, description, thumbnail_url, status, category_id, created_at, updated_at, user_id)
       VALUES ($1, $2, $3, NULL, $4, 'completed', $5, $6, now(), $7)
       RETURNING id, source_url, source_type, title, summary, thumbnail_url, created_at,
                 (SELECT name FROM categories WHERE id = $5) AS category_name,
                 ARRAY[]::text[] AS tag_names`,
      [input.url, input.sourceType, input.title, input.thumbnailUrl ?? null, categoryId, createdAt, userId],
    );
    const videoId = Number(inserted.rows[0].id);
    await linkTags(videoId, input.tags, client);
    await insertAnalysis(videoId, input.tags, input.category, client);
    await client.query('COMMIT');

    const full = await pool.query<VideoRow>(
      `${VIDEO_SELECT}
        WHERE v.id = $1
        GROUP BY v.id, c.name`,
      [videoId],
    );
    return toRecord(full.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteVideo(id: number, userId: number): Promise<boolean> {
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM analysis_results WHERE video_id = $1', [id]);
    await client.query('DELETE FROM video_tags WHERE video_id = $1', [id]);
    const result = await client.query('DELETE FROM videos WHERE id = $1 AND user_id = $2', [id, userId]);
    const deleted = (result.rowCount ?? 0) > 0;
    await client.query(deleted ? 'COMMIT' : 'ROLLBACK');
    return deleted;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  await requirePool().query('SELECT 1');
  return true;
}