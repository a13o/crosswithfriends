---
phase: 06-data-integrity-analysis
plan: 01
subsystem: database
tags: [firebase, postgresql, timestamps, migration, data-integrity]

# Dependency graph
requires:
  - phase: 02-firebase-path-census
    provides: "Complete RTDB path matrix with PG equivalence column"
  - phase: 03-data-overlap-analysis
    provides: "Risk matrix, field-level diffs, Firebase-only inventory"
  - phase: 05-write-path-tracing
    provides: "SERVER_TIME chain deep-dive, assignTimestamp boundary, timestamp mechanisms"
provides:
  - "Complete timestamp dependency chain analysis (getTime, SERVER_TIME, assignTimestamp)"
  - "assignTimestamp() ordering constraint for Phase 7 removal step dependency graph"
  - "Firebase-only data inventory with risk assessment matrix"
  - "user/{id}/history deep-dive with guest user complications and solo key variant"
  - "Per-call-site replacement strategy matrix"
affects: [07-removal-path-assessment, 09-postgresql-schema-analysis]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Integrity analysis layer on top of read/write traces"]

key-files:
  created:
    - ".planning/phases/06-data-integrity-analysis/06-INTEGRITY.md"
  modified: []

key-decisions:
  - "All 6 getTime() consumer sites can safely be replaced with Date.now() -- no GET /api/time endpoint needed"
  - "assignTimestamp() ordering constraint: client-side SERVER_TIME replacement MUST happen before assignTimestamp() removal"
  - "demoGame.js SERVER_TIME is client-side only (never reaches assignTimestamp) -- sentinel is never resolved"
  - "user/{id}/history is highest-priority migration item -- new game_history table with local_id column for guest support"

patterns-established:
  - "Ordering constraint documentation: bidirectional dependency chain with safe/unsafe scenarios"
  - "Risk calibration using Phase 3 severity scale (CRITICAL/HIGH/MEDIUM/LOW) for cross-phase consistency"

requirements-completed: [DATA-03, DATA-04]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 6 Plan 1: Data Integrity Analysis Summary

**Timestamp dependency chain with assignTimestamp() ordering constraint and Firebase-only data inventory with user history deep-dive including guest complications**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T21:52:27Z
- **Completed:** 2026-03-04T21:58:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Documented all 3 timestamp mechanisms (SERVER_TIME, getTime(), Date.now()) with integrity implications and replacement consequences per call site
- Identified and documented the critical assignTimestamp() ordering constraint -- client-side replacement MUST happen before server-side removal to prevent PG data corruption
- Built complete Firebase-only data inventory with 7 active paths, 11 dead/legacy paths, and risk assessment matrix
- Produced dedicated user/{id}/history deep-dive covering data structure, write/read paths, guest user zero-PG-fallback, solo key variant, and PuzzleList merge logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Build timestamp dependency chain analysis (Section 1, DATA-03)** - `ab86856` (feat)
2. **Task 2: Build Firebase-only data inventory (Section 2, DATA-04) and validate ROADMAP criteria** - `2a93274` (feat)

## Files Created/Modified
- `.planning/phases/06-data-integrity-analysis/06-INTEGRITY.md` - Complete data integrity analysis with timestamp chain (Section 1) and Firebase-only inventory (Section 2)

## Decisions Made
- All 6 getTime() consumer sites can safely use Date.now() -- the offset is <1s, read once at page load, and becomes stale during long sessions. No new server endpoint needed.
- assignTimestamp() ordering constraint documented as critical Phase 7 input: replacing SERVER_TIME with Date.now() on client is safe (assignTimestamp passes through numbers), but removing assignTimestamp() before replacing SERVER_TIME corrupts PG (sentinel stored as raw JSON).
- demoGame.js SERVER_TIME is client-side only -- it pushes directly to the local events array, never flows through Socket.IO, so the sentinel is never resolved. Replacing with Date.now() is actually an improvement.
- user/{id}/history rated as highest-priority migration item for Phase 9 -- requires new game_history table with local_id column to support guest users who have zero PG fallback.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 06-INTEGRITY.md provides the data integrity foundation that Phase 7 (Removal Path Assessment) depends on for the removal step dependency graph
- The assignTimestamp() ordering constraint directly feeds Phase 7's step ordering
- The Firebase-only data inventory (especially user/{id}/history) feeds Phase 9 (PostgreSQL Schema Analysis) for schema design priorities
- Two decision-gate unknowns remain from prior phases (LIVE-02: GID counter alignment, LIVE-03: archivedEvents presence) -- these require live data queries and do not block Phase 7 planning

---
*Phase: 06-data-integrity-analysis*
*Completed: 2026-03-04*
