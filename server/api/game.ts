import express from 'express';
import {CreateGameResponse, CreateGameRequest, InfoJson, GetGameResponse} from '../../src/shared/types';

import {addInitialGameEvent} from '../model/game';
import {getPuzzleSolves} from '../model/puzzle_solve';
import {getPuzzleInfo} from '../model/puzzle';
import {saveGameSnapshot, getGameSnapshot} from '../model/game_snapshot';
import {verifyAccessToken} from '../auth/jwt';
import {pool} from '../model/pool';

const router = express.Router();

router.post<{}, CreateGameResponse, CreateGameRequest>('/', async (req, res) => {
  console.log('got req', req.headers, req.body);
  const gid = await addInitialGameEvent(req.body.gid, req.body.pid);
  res.json({
    gid,
  });
});

router.get<{gid: string}, GetGameResponse>('/:gid', async (req, res) => {
  console.log('got req', req.headers, req.body);
  try {
    const {gid} = req.params;

    const puzzleSolves = await getPuzzleSolves([gid]);

    if (puzzleSolves.length === 0) {
      return res.sendStatus(404);
    }

    const gameState = puzzleSolves[0];
    const puzzleInfo = (await getPuzzleInfo(gameState.pid)) as InfoJson;

    res.json({
      gid,
      title: gameState.title,
      author: puzzleInfo?.author || 'Unknown',
      duration: gameState.time_taken_to_solve,
      size: gameState.size,
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    res.sendStatus(500);
  }
  return undefined;
});

router.post<{gid: string}>('/:gid/dismiss', async (req, res, next) => {
  try {
    const {gid} = req.params;

    // Require auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.sendStatus(401);
    }
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    // Don't overwrite an existing snapshot
    const existing = await getGameSnapshot(gid);
    if (existing) return res.sendStatus(409);

    // Look up pid from the create event
    const result = await pool.query(
      `SELECT event_payload->'params'->>'pid' AS pid FROM game_events WHERE gid = $1 AND event_type = 'create'`,
      [gid]
    );
    if (result.rows.length === 0) return res.sendStatus(404);

    const pid = result.rows[0].pid;
    await saveGameSnapshot(gid, pid, {dismissed: true});
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

export default router;
