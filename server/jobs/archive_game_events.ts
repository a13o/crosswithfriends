/**
 * Automated archival/cleanup of game_events.
 *
 * Three categories of cleanup:
 *   1. Solved games with snapshots (replay_retained=false) — delete all events
 *   2. Abandoned games (no snapshot, no solve, inactive for N days) — delete all events
 *   3. (Optional) Expire replay_retained flag after N days
 *
 * Usage:
 *   # Via dotenv-cli (recommended):
 *   dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json server/jobs/archive_game_events.ts
 *
 *   # Dry run:
 *   DRY_RUN=1 dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json server/jobs/archive_game_events.ts
 *
 * Environment variables:
 *   DRY_RUN            - Set to "1" for read-only mode (default: 0)
 *   GRACE_DAYS         - Grace period for solved games in days (default: 7)
 *   ABANDON_DAYS       - Inactivity threshold for abandoned games in days (default: 90)
 *   BATCH_SIZE         - Max games to process per category per run (default: 1000)
 *   DELETE_CREATE_EVENTS - Set to "1" to delete create events for solved games (default: 0)
 *   EXPIRE_REPLAY_DAYS - Auto-expire replay_retained after N days, 0 = disabled (default: 0)
 */

import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized: false} : undefined,
});

const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000', 10);
const GRACE_DAYS = parseInt(process.env.GRACE_DAYS || '7', 10);
const ABANDON_DAYS = parseInt(process.env.ABANDON_DAYS || '90', 10);
const DELETE_CREATE_EVENTS = process.env.DELETE_CREATE_EVENTS === '1';
const EXPIRE_REPLAY_DAYS = parseInt(process.env.EXPIRE_REPLAY_DAYS || '0', 10);

interface CleanupStats {
  category: string;
  gamesProcessed: number;
  eventsDeleted: number;
}

/**
 * Category 1: Delete events for solved games with snapshots (replay_retained=false).
 * When DELETE_CREATE_EVENTS is false, keeps the create event as a safety net.
 * When DELETE_CREATE_EVENTS is true, deletes ALL events (including create) but only
 * if the puzzle still exists in the puzzles table.
 */
async function cleanupSolvedGames(): Promise<CleanupStats> {
  const stats: CleanupStats = {category: 'solved', gamesProcessed: 0, eventsDeleted: 0};

  const eventTypeFilter = DELETE_CREATE_EVENTS
    ? '' // delete all events
    : "AND ge.event_type != 'create'"; // keep create events

  // Safety: when deleting create events, only do so if the puzzle still exists
  const puzzleExistsCheck = DELETE_CREATE_EVENTS
    ? 'AND EXISTS (SELECT 1 FROM puzzles p WHERE p.pid = gs.pid)'
    : '';

  // Find eligible games
  const {rows: eligible} = await pool.query(
    `SELECT gs.gid
     FROM game_snapshots gs
     WHERE gs.replay_retained = false
       AND gs.created_at < NOW() - ($1 || ' days')::interval
       ${puzzleExistsCheck}
       AND EXISTS (
         SELECT 1 FROM game_events ge
         WHERE ge.gid = gs.gid ${eventTypeFilter}
       )
     LIMIT $2`,
    [String(GRACE_DAYS), BATCH_SIZE]
  );

  stats.gamesProcessed = eligible.length;
  if (eligible.length === 0) return stats;

  const gids = eligible.map((r: {gid: string}) => r.gid);

  if (DRY_RUN) {
    const {
      rows: [{count}],
    } = await pool.query(
      `SELECT COUNT(*) FROM game_events ge
       WHERE ge.gid = ANY($1) ${eventTypeFilter}`,
      [gids]
    );
    stats.eventsDeleted = Number(count);
    console.log(`  [DRY RUN] Would delete ${count} events from ${gids.length} solved games`);
  } else {
    const result = await pool.query(
      `DELETE FROM game_events ge
       WHERE ge.gid = ANY($1) ${eventTypeFilter}`,
      [gids]
    );
    stats.eventsDeleted = result.rowCount || 0;
    console.log(`  Deleted ${stats.eventsDeleted} events from ${gids.length} solved games`);
  }

  if (eligible.length === BATCH_SIZE) {
    console.log('  Batch limit reached for solved games. Run again to process more.');
  }

  return stats;
}

/**
 * Category 2: Delete all events for abandoned games.
 * Abandoned = no snapshot, no puzzle_solves record, no activity for ABANDON_DAYS.
 */
async function cleanupAbandonedGames(): Promise<CleanupStats> {
  const stats: CleanupStats = {category: 'abandoned', gamesProcessed: 0, eventsDeleted: 0};

  const {rows: eligible} = await pool.query(
    `SELECT ge.gid
     FROM game_events ge
     WHERE NOT EXISTS (SELECT 1 FROM game_snapshots gs WHERE gs.gid = ge.gid)
       AND NOT EXISTS (SELECT 1 FROM puzzle_solves ps WHERE ps.gid = ge.gid)
     GROUP BY ge.gid
     HAVING MAX(ge.ts) < NOW() - ($1 || ' days')::interval
     LIMIT $2`,
    [String(ABANDON_DAYS), BATCH_SIZE]
  );

  stats.gamesProcessed = eligible.length;
  if (eligible.length === 0) return stats;

  const gids = eligible.map((r: {gid: string}) => r.gid);

  if (DRY_RUN) {
    const {
      rows: [{count}],
    } = await pool.query(`SELECT COUNT(*) FROM game_events WHERE gid = ANY($1)`, [gids]);
    stats.eventsDeleted = Number(count);
    console.log(`  [DRY RUN] Would delete ${count} events from ${gids.length} abandoned games`);
  } else {
    const result = await pool.query(`DELETE FROM game_events WHERE gid = ANY($1)`, [gids]);
    stats.eventsDeleted = result.rowCount || 0;
    console.log(`  Deleted ${stats.eventsDeleted} events from ${gids.length} abandoned games`);
  }

  if (eligible.length === BATCH_SIZE) {
    console.log('  Batch limit reached for abandoned games. Run again to process more.');
  }

  return stats;
}

/**
 * Category 3: Auto-expire replay_retained flag after EXPIRE_REPLAY_DAYS.
 * Disabled by default (EXPIRE_REPLAY_DAYS=0).
 */
async function expireReplayRetention(): Promise<number> {
  if (EXPIRE_REPLAY_DAYS <= 0) return 0;

  if (DRY_RUN) {
    const {
      rows: [{count}],
    } = await pool.query(
      `SELECT COUNT(*) FROM game_snapshots
       WHERE replay_retained = true
         AND created_at < NOW() - ($1 || ' days')::interval`,
      [String(EXPIRE_REPLAY_DAYS)]
    );
    console.log(`  [DRY RUN] Would expire replay_retained for ${count} games`);
    return Number(count);
  }

  const result = await pool.query(
    `UPDATE game_snapshots
     SET replay_retained = false
     WHERE replay_retained = true
       AND created_at < NOW() - ($1 || ' days')::interval`,
    [String(EXPIRE_REPLAY_DAYS)]
  );
  const expired = result.rowCount || 0;
  if (expired > 0) {
    console.log(`  Expired replay_retained for ${expired} games`);
  }
  return expired;
}

async function main() {
  console.log('=== Game Events Archive Job ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Settings: GRACE_DAYS=${GRACE_DAYS}, ABANDON_DAYS=${ABANDON_DAYS}, BATCH_SIZE=${BATCH_SIZE}`);
  console.log(`  DELETE_CREATE_EVENTS=${DELETE_CREATE_EVENTS}, EXPIRE_REPLAY_DAYS=${EXPIRE_REPLAY_DAYS}`);
  console.log('');

  // Category 3 first — expire replays so they become eligible for Category 1
  console.log('--- Category 3: Replay retention expiry ---');
  const expired = await expireReplayRetention();
  if (expired === 0 && EXPIRE_REPLAY_DAYS <= 0) {
    console.log('  Disabled (EXPIRE_REPLAY_DAYS=0)');
  } else if (expired === 0) {
    console.log('  No replays to expire.');
  }
  console.log('');

  // Category 1 — solved games with snapshots
  console.log('--- Category 1: Solved games with snapshots ---');
  const solvedStats = await cleanupSolvedGames();
  if (solvedStats.gamesProcessed === 0) {
    console.log('  Nothing to clean up.');
  }
  console.log('');

  // Category 2 — abandoned games
  console.log('--- Category 2: Abandoned games ---');
  const abandonedStats = await cleanupAbandonedGames();
  if (abandonedStats.gamesProcessed === 0) {
    console.log('  Nothing to clean up.');
  }
  console.log('');

  // Summary
  console.log('=== Summary ===');
  console.log(
    `Solved: ${solvedStats.gamesProcessed} games, ${solvedStats.eventsDeleted} events ${DRY_RUN ? '(would be)' : ''} deleted`
  );
  console.log(
    `Abandoned: ${abandonedStats.gamesProcessed} games, ${abandonedStats.eventsDeleted} events ${DRY_RUN ? '(would be)' : ''} deleted`
  );
  if (EXPIRE_REPLAY_DAYS > 0) {
    console.log(`Replay expirations: ${expired}`);
  }
  console.log(
    `Total: ${solvedStats.eventsDeleted + abandonedStats.eventsDeleted} events ${DRY_RUN ? '(would be)' : ''} deleted`
  );

  await pool.end();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
