-- alter_puzzle_solves_relax_time_check.sql
-- Relax the time_taken_to_solve CHECK constraint from > 0 to >= 0.
--
-- Why: reveal-puzzle solves performed before the clock has ticked have
-- totalTime = 0, which fails the original CHECK. recordSolve was swallowing
-- the error, leaving game_snapshots rows with no matching puzzle_solves row
-- and the puzzle showing as unsolved on the user's profile and puzzle list.
--
-- Usage:  psql -U dfacadmin -d <dbname> -f server/sql/alter_puzzle_solves_relax_time_check.sql

DO $$
DECLARE
  cname text;
BEGIN
  -- Drop the old positive-only CHECK if it exists (anonymous CHECKs get a
  -- generated name like puzzle_solves_time_taken_to_solve_check).
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  WHERE cls.relname = 'puzzle_solves'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%time_taken_to_solve%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE puzzle_solves DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE puzzle_solves
  ADD CONSTRAINT puzzle_solves_time_taken_to_solve_check
  CHECK (time_taken_to_solve >= 0);
