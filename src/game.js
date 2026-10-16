/** Courtesy's entire rule set. The 24 physical counters never leave hands and pots. */
export function initialState(firstPlayer = 0) {
  if (firstPlayer !== 0 && firstPlayer !== 1) throw new TypeError('First player must be 0 or 1.');
  return { hands: [12, 12], scores: [0, 0], pots: Array.from({ length: 3 }, () => ({ count: 0, owner: null })), turn: firstPlayer, winner: null, ply: 0 };
}

/** Returns false for malformed or physically impossible persisted positions. */
export function validateState(state) {
  if (!state || typeof state !== 'object') return false;
  const pair = value => Array.isArray(value) && value.length === 2 && value.every(n => Number.isSafeInteger(n) && n >= 0);
  if (!pair(state.hands) || !pair(state.scores) || ![0, 1].includes(state.turn)) return false;
  if (!Number.isSafeInteger(state.ply) || state.ply < 0 || ![null, 0, 1].includes(state.winner)) return false;
  if (!Array.isArray(state.pots) || state.pots.length !== 3) return false;
  let counters = state.hands[0] + state.hands[1];
  for (const pot of state.pots) {
    if (!pot || ![0, 1, 3, 7, 15].includes(pot.count)) return false;
    if (pot.count === 0 ? pot.owner !== null : ![0, 1].includes(pot.owner)) return false;
    counters += pot.count;
  }
  if (counters !== 24 || state.scores.some(score => score > 39)) return false;
  if (state.winner === null) return state.scores.every(score => score < 25);
  return state.turn === state.winner && state.scores[state.winner] >= 25 && state.scores[1 - state.winner] < 25;
}

export function legalActions(state) {
  if (state.winner !== null) return [];
  const actions = [];
  state.pots.forEach((pot, index) => {
    if (!pot.count && state.hands[state.turn] >= 1) actions.push({ type: 'start', pot: index });
    else if (pot.owner === state.turn) actions.push({ type: 'collect', pot: index });
    else if (pot.count && state.hands[state.turn] >= pot.count + 1) actions.push({ type: 'take', pot: index });
  });
  return actions.length ? actions : [{ type: 'pass' }];
}

export function applyAction(state, action) {
  if (!validateState(state)) throw new TypeError('Invalid game state.');
  if (!action || !legalActions(state).some(legal => legal.type === action.type && legal.pot === action.pot)) throw new Error('Illegal action.');
  const next = { ...state, hands: [...state.hands], scores: [...state.scores], pots: state.pots.map(pot => ({ ...pot })), ply: state.ply + 1 };
  const player = state.turn;
  if (action.type !== 'pass') {
    const pot = next.pots[action.pot];
    if (action.type === 'start') {
      next.hands[player] -= 1;
      pot.count = 1;
      pot.owner = player;
    } else if (action.type === 'take') {
      next.hands[player] -= pot.count + 1;
      pot.count = 2 * pot.count + 1;
      pot.owner = player;
    } else {
      next.scores[player] += pot.count;
      next.hands[1 - player] += pot.count;
      pot.count = 0;
      pot.owner = null;
      if (next.scores[player] >= 25) next.winner = player;
    }
  }
  // A finished position keeps the winning player as turn, simplifying replay.
  if (next.winner === null) next.turn = 1 - player;
  return next;
}

export function describeAction(state, action) {
  if (action.type === 'pass') return 'Pass — no legal move.';
  const count = state.pots[action.pot].count;
  const label = action.pot + 1;
  if (action.type === 'start') return `Start pot ${label} with 1 counter.`;
  if (action.type === 'take') return `Take pot ${label}: pay ${count + 1}, making ${2 * count + 1}.`;
  return `Collect pot ${label}: score ${count} and give ${count} counters to the other player.`;
}
