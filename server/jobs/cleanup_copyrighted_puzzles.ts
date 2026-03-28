/**
 * Delete public puzzles that contain copyrighted content (e.g. New Yorker).
 *
 * Usage:
 *   dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json server/jobs/cleanup_copyrighted_puzzles.ts
 *
 *   # Dry run:
 *   DRY_RUN=1 dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json server/jobs/cleanup_copyrighted_puzzles.ts
 */

import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized: false} : undefined,
  statement_timeout: 120000,
});

const DRY_RUN = process.env.DRY_RUN === '1';

const BLOCKED_PATTERNS = ['%New Yorker%'];

async function main() {
  console.log('=== Copyrighted Puzzle Cleanup ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  let totalDeleted = 0;

  for (const pattern of BLOCKED_PATTERNS) {
    if (DRY_RUN) {
      const {
        rows: [{count}],
      } = await pool.query(`SELECT COUNT(*) FROM puzzles WHERE is_public = true AND content::text ILIKE $1`, [
        pattern,
      ]);
      console.log(`  [DRY RUN] Would delete ${count} puzzles matching "${pattern}"`);
      totalDeleted += Number(count);
    } else {
      const result = await pool.query(
        `DELETE FROM puzzles WHERE is_public = true AND content::text ILIKE $1`,
        [pattern]
      );
      const deleted = result.rowCount || 0;
      console.log(`  Deleted ${deleted} puzzles matching "${pattern}"`);
      totalDeleted += deleted;
    }
  }

  console.log('');
  console.log(`=== Total: ${totalDeleted} puzzles ${DRY_RUN ? '(would be)' : ''} deleted ===`);

  await pool.end();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
