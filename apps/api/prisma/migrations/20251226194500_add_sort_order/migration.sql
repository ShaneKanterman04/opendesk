-- Add sort_order columns to folders, files, documents
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "sort_order" integer;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "sort_order" integer;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "sort_order" integer;

-- Optional: initialize existing rows with sequential sort order by created_at
-- Assign ascending numbers per folder (including NULL parentId)
WITH f AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "parentId" ORDER BY "createdAt") AS rn
  FROM folders
)
UPDATE folders SET sort_order = f.rn FROM f WHERE folders.id = f.id;

WITH fi AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "folderId" ORDER BY "createdAt") AS rn
  FROM files
)
UPDATE files SET sort_order = fi.rn FROM fi WHERE files.id = fi.id;

WITH d AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "folderId" ORDER BY "createdAt") AS rn
  FROM documents
)
UPDATE documents SET sort_order = d.rn FROM d WHERE documents.id = d.id;
