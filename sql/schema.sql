-- ============================================================
-- ClipKeeper 資料庫結構參考（mirror：與線上的 Video 庫一致）
-- 不需在線上執行；僅供了解 / 重建參考
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR NOT NULL,
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL,
  user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  source_url VARCHAR NOT NULL,
  source_type VARCHAR NOT NULL,
  title VARCHAR,
  description VARCHAR,
  thumbnail_url VARCHAR,
  local_path VARCHAR,
  duration DOUBLE PRECISION,
  width INTEGER,
  height INTEGER,
  status VARCHAR NOT NULL,
  summary VARCHAR,
  category_id INTEGER REFERENCES categories(id),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS video_tags (
  video_id INTEGER NOT NULL REFERENCES videos(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (video_id, tag_id)
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES videos(id),
  provider VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  summary VARCHAR,
  categories JSON,
  tags JSON,
  objects JSON,
  transcript VARCHAR,
  confidence DOUBLE PRECISION,
  error_message VARCHAR,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);