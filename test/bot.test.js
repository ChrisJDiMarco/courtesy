import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, legalActions, applyAction } from '../src/game.js';
import { chooseAction } from '../src/bot.js';

const position = (hands, pots, scores = [0, 0]) => ({ hands, scores, pots: pots.map(([count, owner]) => ({ count, owner })), turn: 0, winner: null, ply: 0 });

test('bot collects an immediate win at both difficulty levels', () => {
  const state = position([8, 9], [[7, 0], [0, null], [0, null]], [18, 20]);
  for (const difficulty of ['casual', 'thoughtful']) assert.deepEqual(chooseAction(state, { difficulty }), { type: 'collect', pot: 0 });
});

test('bot takes an opponent winning pot when that is the only immediate block', () => {
  const state = position([8, 8], [[7, 1], [1, 0], [0, null]], [0, 18]);
  for (const difficulty of ['casual', 'thoughtful']) assert.deepEqual(chooseAction(state, { difficulty, timeMs: 40 }), { type: 'take', pot: 0 });
});

test('bot passes only when forced and returns null for a finished game', () => {
  const forced = position([0, 9], [[15, 1], [0, null], [0, null]]);
  assert.deepEqual(chooseAction(forced), { type: 'pass' });
  const won = applyAction(position([8, 9], [[7, 0], [0, null], [0, null]], [18, 0]), { type: 'collect', pot: 0 });
  assert.equal(chooseAction(won), null);
  assert.throws(() => chooseAction({}));
});

test('bot respects a bounded budget, produces legal moves, and never mutates its input', () => {
  let state = initialState();
  const start = performance.now();
  for (let i = 0; i < 80 && state.winner === null; i += 1) {
    const before = structuredClone(state);
    const action = chooseAction(state, { difficulty: i % 2 ? 'casual' : 'thoughtful', timeMs: 5, maxNodes: 700 });
    assert.ok(legalActions(state).some(legal => JSON.stringify(legal) === JSON.stringify(action)));
    assert.deepEqual(state, before);
    state = applyAction(state, action);
  }
  assert.ok(performance.now() - start < 5000);
});
