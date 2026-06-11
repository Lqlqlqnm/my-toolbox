-- 分析图片存储（15天自动清理）
CREATE TABLE IF NOT EXISTS analysis_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id INTEGER,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_images_created ON analysis_images(created_at);
CREATE INDEX IF NOT EXISTS idx_images_analysis ON analysis_images(analysis_id);
