-- Game Events Assessment Queries
-- Run these on production (read-only) before implementing archival.
-- They help understand data distribution and potential savings.

-- 1a. Event distribution by type and size
SELECT event_type, COUNT(*) AS event_count,
       pg_size_pretty(SUM(pg_column_size(event_payload)::bigint)) AS payload_size
FROM game_events GROUP BY event_type ORDER BY event_count DESC;

-- 1b. Game states overview
SELECT
  COUNT(DISTINCT ge.gid) AS total_games,
  COUNT(DISTINCT gs.gid) AS with_snapshots,
  COUNT(DISTINCT CASE WHEN gs.replay_retained = false THEN gs.gid END) AS snapshot_no_replay,
  COUNT(DISTINCT CASE WHEN gs.replay_retained = true THEN gs.gid END) AS snapshot_with_replay
FROM (SELECT DISTINCT gid FROM game_events) ge
LEFT JOIN game_snapshots gs ON gs.gid = ge.gid;

-- 1c. Create event sizes for snapshotted games (savings from eliminating them)
SELECT COUNT(*) AS count,
       pg_size_pretty(SUM(pg_column_size(event_payload)::bigint)) AS total_size,
       pg_size_pretty(AVG(pg_column_size(event_payload)::bigint)::bigint) AS avg_size
FROM game_events
WHERE event_type = 'create'
  AND gid IN (SELECT gid FROM game_snapshots WHERE replay_retained = false);

-- 1d. Abandoned games by staleness (no snapshot, no solve)
SELECT
  CASE
    WHEN max_ts < NOW() - INTERVAL '90 days' THEN '90+ days'
    WHEN max_ts < NOW() - INTERVAL '60 days' THEN '60-90 days'
    WHEN max_ts < NOW() - INTERVAL '30 days' THEN '30-60 days'
    ELSE 'active (<30 days)'
  END AS staleness,
  COUNT(*) AS game_count, SUM(event_count) AS total_events
FROM (
  SELECT ge.gid, MAX(ge.ts) AS max_ts, COUNT(*) AS event_count
  FROM game_events ge
  WHERE NOT EXISTS (SELECT 1 FROM game_snapshots gs WHERE gs.gid = ge.gid)
    AND NOT EXISTS (SELECT 1 FROM puzzle_solves ps WHERE ps.gid = ge.gid)
  GROUP BY ge.gid
) stale GROUP BY 1 ORDER BY 1;

-- 1e. Solved games without snapshots (need backfill first)
SELECT COUNT(DISTINCT ps.gid) AS solves_without_snapshots
FROM puzzle_solves ps
WHERE NOT EXISTS (SELECT 1 FROM game_snapshots gs WHERE gs.gid = ps.gid);

-- 1f. Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS total_size,
       pg_size_pretty(pg_relation_size(oid)) AS table_size,
       pg_size_pretty(pg_indexes_size(oid)) AS index_size
FROM pg_class
WHERE relname IN ('game_events', 'game_snapshots', 'puzzle_solves', 'puzzles', 'firebase_history')
ORDER BY pg_total_relation_size(oid) DESC;
