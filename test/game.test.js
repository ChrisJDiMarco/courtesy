import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, legalActions, applyAction, validateState, describeAction } from '../src/game.js';

function position(hands, pots, scores = [0, 0], turn = 0) {
  return { hands, pots: pots.map(([count, owner]) => ({ count, owner })), scores, turn, winner: null, ply: 0 };
}
const counters = state => state.hands.reduce((a, b) => a + b) + state.pots.reduce((n, pot) => n + pot.count, 0);

test('initial position is fresh, validated, and permits only one-counter starts', () => {
  const state = initialState();
  assert.equal(validateState(state), true);
  assert.equal(initialState(1).turn, 1);
  assert.throws(() => initialState(2));
  assert.deepEqual(legalActions(state), [0, 1, 2].map(pot => ({ type: 'start', pot })));
  const second = initialState();
  state.pots[0].count = 1;
  assert.equal(second.pots[0].count, 0);
});

test('start, successive take costs, collection, and ownership exactly follow rules', () => {
  let state = initialState();
  state = applyAction(state, { type: 'start', pot: 0 });
  assert.deepEqual(state.hands, [11, 12]);
  state = applyAction(state, { type: 'take', pot: 0 });
  assert.deepEqual(state.pots[0], { count: 3, owner: 1 });
  assert.deepEqual(state.hands, [11, 10]);
  state = applyAction(state, { type: 'take', pot: 0 });
  assert.deepEqual(state.pots[0], { count: 7, owner: 0 });
  state = applyAction(state, { type: 'take', pot: 0 });
  assert.deepEqual(state.pots[0], { count: 15, owner: 1 });
  assert.deepEqual(state.hands, [7, 2]);
  assert.equal(legalActions(state).some(action => action.type === 'take'), false);
  state = applyAction(state, { type: 'start', pot: 1 });
  state = applyAction(state, { type: 'collect', pot: 0 });
  assert.deepEqual(state.scores, [0, 15]);
  assert.deepEqual(state.hands, [21, 2]);
  assert.equal(counters(state), 24);
});

test('two safe sevens: collecting one finances capture of the other and its fifteen-point payout', () => {
  let state = position([5, 5], [[7, 0], [7, 0], [0, null]]);
  assert.equal(validateState(state), true);
  assert.ok(state.hands[1] < 8); // Neither seven is currently affordable to the opponent.
  state = applyAction(state, { type: 'collect', pot: 0 });
  assert.deepEqual(state.hands, [5, 12]);
  assert.deepEqual(state.scores, [7, 0]);
  state = applyAction(state, { type: 'take', pot: 1 });
  assert.deepEqual(state.pots[1], { count: 15, owner: 1 });
  assert.deepEqual(state.hands, [5, 4]);
  assert.ok(!legalActions(state).some(action => action.type === 'take' && action.pot === 1));
  state = applyAction(state, { type: 'start', pot: 0 });
  state = applyAction(state, { type: 'collect', pot: 1 });
  assert.deepEqual(state.scores, [7, 15]);
  assert.deepEqual(state.hands, [19, 4]);
  assert.equal(counters(state), 24);
});

test('collecting a small pot before a big one can turn the big pot from safe to takeable', () => {
  const original = position([7, 7], [[3, 0], [7, 0], [0, null]]);
  assert.equal(validateState(original), true);
  const smallFirst = applyAction(original, { type: 'collect', pot: 0 });
  assert.equal(smallFirst.hands[1], 10);
  assert.ok(legalActions(smallFirst).some(action => action.type === 'take' && action.pot === 1));
  const captured = applyAction(smallFirst, { type: 'take', pot: 1 });
  assert.equal(captured.pots[1].count, 15);
  assert.equal(captured.pots[1].owner, 1);
  const bigFirst = applyAction(original, { type: 'collect', pot: 1 });
  assert.equal(bigFirst.scores[0], 7);
  assert.deepEqual(bigFirst.pots[1], { count: 0, owner: null });
  assert.equal(counters(captured), 24);
  assert.equal(counters(bigFirst), 24);
});

test('pass is forced only; victory is immediate at or beyond 25', () => {
  const forced = position([0, 9], [[15, 1], [0, null], [0, null]]);
  assert.deepEqual(legalActions(forced), [{ type: 'pass' }]);
  const passed = applyAction(forced, { type: 'pass' });
  assert.equal(passed.turn, 1);
  assert.equal(passed.ply, 1);
  assert.deepEqual(passed.hands, forced.hands);
  assert.throws(() => applyAction(initialState(), { type: 'pass' }));
  for (const score of [18, 24]) {
    const nearWin = position([8, 9], [[7, 0], [0, null], [0, null]], [score, 12]);
    const won = applyAction(nearWin, { type: 'collect', pot: 0 });
    assert.equal(won.winner, 0);
    assert.equal(won.turn, 0);
    assert.equal(won.scores[0], score + 7);
    assert.equal(validateState(won), true);
    assert.deepEqual(legalActions(won), []);
    assert.throws(() => applyAction(won, { type: 'start', pot: 0 }));
  }
});

test('actions are immutable and illegal or malformed positions/actions are rejected', () => {
  const state = initialState();
  const snapshot = structuredClone(state);
  state.hands.forEach(Object.freeze);
  Object.freeze(state.hands); Object.freeze(state.scores);
  state.pots.forEach(Object.freeze); Object.freeze(state.pots); Object.freeze(state);
  const next = applyAction(state, { type: 'start', pot: 0 });
  assert.deepEqual(state, snapshot);
  assert.notEqual(next.pots[1], state.pots[1]);
  for (const action of [null, {}, { type: 'take', pot: 0 }, { type: 'collect', pot: 0 }, { type: 'start', pot: 3 }, { type: 'start', pot: '0' }]) assert.throws(() => applyAction(state, action));
  const badStates = [null, {}, { ...snapshot, hands: [-1, 25] }, { ...snapshot, hands: [12.5, 11.5] }, { ...snapshot, turn: 2 }, { ...snapshot, winner: 0 }, { ...snapshot, scores: [25, 0] }, { ...snapshot, ply: -1 }, { ...snapshot, pots: [{ count: 2, owner: 0 }, ...snapshot.pots.slice(1)] }, { ...snapshot, pots: [{ count: 0, owner: 0 }, ...snapshot.pots.slice(1)] }, { ...snapshot, pots: [{ count: 1, owner: null }, ...snapshot.pots.slice(1)] }, { ...snapshot, hands: [13, 12] }];
  for (const bad of badStates) {
    assert.equal(validateState(bad), false);
    assert.throws(() => applyAction(bad, { type: 'pass' }));
  }
  assert.match(describeAction(snapshot, { type: 'start', pot: 0 }), /1 counter/);
});

test('seeded randomized legal games conserve all counters, validate, and reach victory', () => {
  let seed = 748193;
  let passes = 0;
  let wins = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let game = 0; game < 100; game += 1) {
    let state = initialState(game % 2);
    for (let move = 0; move < 2000 && state.winner === null; move += 1) {
      const actions = legalActions(state);
      const action = actions[Math.floor(random() * actions.length)];
      if (action.type === 'pass') passes += 1;
      state = applyAction(state, action);
      assert.equal(counters(state), 24);
      assert.equal(validateState(state), true);
    }
    if (state.winner !== null) wins += 1;
  }
  assert.equal(wins, 100);
  assert.ok(passes > 0, 'seeded games exercise forced pass');
});

function reachableFork() {
  let state = initialState();
  for (let pot = 0; pot < 3; pot += 1) {
    state = applyAction(state, { type: 'start', pot });
    state = applyAction(state, { type: 'take', pot });
  }
  assert.deepEqual(state.hands, [9, 6]);
  assert.deepEqual(state.pots.map(pot => pot.count), [3, 3, 3]);
  state = applyAction(state, { type: 'take', pot: 0 });
  state = applyAction(state, { type: 'collect', pot: 1 });
  assert.deepEqual(state.hands, [8, 6]);
  assert.deepEqual(state.scores, [0, 3]);
  return state;
}

test('the full reachable two-safe-sevens trap also survives delaying with the small pot', () => {
  let state = reachableFork();
  state = applyAction(state, { type: 'take', pot: 2 });
  state = applyAction(state, { type: 'start', pot: 1 });
  assert.deepEqual(state.hands, [4, 5]);
  assert.deepEqual(state.pots.map(pot => pot.count), [7, 1, 7]);
  const cash = applyAction(state, { type: 'collect', pot: 0 });
  assert.equal(cash.hands[1], 12);
  const captured = applyAction(cash, { type: 'take', pot: 2 });
  assert.deepEqual(captured.pots[2], { count: 15, owner: 1 });
  let delayed = applyAction(state, { type: 'take', pot: 1 });
  delayed = applyAction(delayed, { type: 'take', pot: 1 });
  assert.deepEqual(delayed.hands, [2, 1]);
  assert.deepEqual(legalActions(delayed), [{ type: 'collect', pot: 0 }, { type: 'collect', pot: 2 }]);
  delayed = applyAction(delayed, { type: 'collect', pot: 0 });
  assert.equal(delayed.hands[1], 8);
  delayed = applyAction(delayed, { type: 'take', pot: 2 });
  assert.deepEqual(delayed.pots[2], { count: 15, owner: 1 });
  assert.equal(validateState(delayed), true);
});

test('reachable small-before-big: cashing one leaves opponent at seven, below the eight-counter take cost', () => {
  let state = reachableFork();
  state = applyAction(state, { type: 'start', pot: 1 });
  state = applyAction(state, { type: 'collect', pot: 2 });
  assert.deepEqual(state.hands, [10, 6]);
  assert.deepEqual(state.scores, [0, 6]);
  assert.deepEqual(state.pots.map(pot => pot.count), [7, 1, 0]);
  const smallFirst = applyAction(state, { type: 'collect', pot: 1 });
  assert.equal(smallFirst.hands[1], 7);
  assert.ok(!legalActions(smallFirst).some(action => action.type === 'take' && action.pot === 0));
  const bigFirst = applyAction(state, { type: 'collect', pot: 0 });
  assert.equal(bigFirst.hands[1], 13);
  assert.ok(legalActions(bigFirst).some(action => action.type === 'take' && action.pot === 1));
  assert.equal(validateState(smallFirst), true);
  assert.equal(validateState(bigFirst), true);
});
