import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {getInProgressGames} from '../../model/puzzle_solve';

describe('getInProgressGames', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns empty array when user has no linked dfac_ids', async () => {
    pool.query.mockResolvedValueOnce({rows: []});

    const result = await getInProgressGames('user-123');

    expect(result).toEqual([]);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT dfac_id FROM user_identity_map WHERE user_id = $1', [
      'user-123',
    ]);
  });

  it('returns in-progress games when user has linked dfac_ids', async () => {
    // First call: user_identity_map lookup
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    // Second call: main in-progress query
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          gid: 'game-1',
          pid: 'puzzle-1',
          title: 'Sunday Crossword',
          size: '15x15',
          last_activity: new Date('2026-02-22T12:00:00Z'),
        },
      ],
    });

    const result = await getInProgressGames('user-123');

    expect(result).toEqual([
      {
        gid: 'game-1',
        pid: 'puzzle-1',
        title: 'Sunday Crossword',
        size: '15x15',
        lastActivity: '2026-02-22T12:00:00.000Z',
      },
    ]);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('uses "Untitled" when title is null', async () => {
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    pool.query.mockResolvedValueOnce({
      rows: [{gid: 'game-1', pid: 'puzzle-1', title: null, size: '15x15', last_activity: null}],
    });

    const result = await getInProgressGames('user-123');

    expect(result[0].title).toBe('Untitled');
    expect(result[0].lastActivity).toBe('');
  });
});
