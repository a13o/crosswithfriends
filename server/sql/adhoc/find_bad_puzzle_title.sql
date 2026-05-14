-- Find the bad puzzle Mala reported. The screenshot showed a clean
-- titleOverride ("NY Times, Monday, April 13. 2026") plus a multi-kilobyte
-- SVG-dump base title surfacing as the "Originally:" line. Looking for
-- puzzles where info.title (base) is enormous regardless of upload date.
-- Read-only; safe to run.

-- 1) All puzzles where info.title (base) is unusually long. Real titles
--    are well under 200 chars; SVG dumps are kilobytes.
SELECT
  pid,
  uploaded_at,
  uploaded_by,
  length(content->'info'->>'title') AS title_len,
  length(content->'info'->>'titleOverride') AS title_override_len,
  LEFT(content->'info'->>'title', 80) AS title_preview,
  LEFT(content->'info'->>'titleOverride', 80) AS title_override_preview,
  jsonb_array_length(content->'grid') AS grid_size
FROM puzzles
WHERE length(content->'info'->>'title') > 500
   OR length(content->'info'->>'titleOverride') > 500
ORDER BY length(content->'info'->>'title') DESC NULLS LAST
LIMIT 20;

-- 2) Same idea, narrower: NYT-tagged via titleOverride and big grid
--    (Sunday is 21x21). Should fall out of #1 too but kept as a focused
--    cross-check if #1 returns lots of noise.
SELECT
  pid,
  uploaded_at,
  uploaded_by,
  jsonb_array_length(content->'grid') AS grid_size,
  length(content->'info'->>'title') AS title_len,
  LEFT(content->'info'->>'titleOverride', 80) AS title_override_preview
FROM puzzles
WHERE content->'info'->>'titleOverride' ILIKE '%NY Times%'
  AND length(content->'info'->>'title') > 500
ORDER BY uploaded_at DESC
LIMIT 10;
