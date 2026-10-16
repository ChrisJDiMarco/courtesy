import { applyAction, legalActions, validateState } from './game.js';

const WIN = 1_000_000;
const winningCollect = state => legalActions(state).find(action => action.type === 'collect' && state.scores[state.turn] + state.pots[action.pot].count >= 25);

function evaluate(state, player) {
  if (state.winner !== null) return state.winner === player ? WIN : -WIN;
  const other = 1 - player;
  let value = (state.scores[player] - state.scores[other]) * 110 + (state.hands[player] - state.hands[other]) * 2;
  for (const pot of state.pots) {
    if (!pot.count) continue;
    const sign = pot.owner === player ? 1 : -1;
    const enemy = 1 - pot.owner;
    const safe = state.hands[enemy] < pot.count + 1;
    // A safe pot is valuable, but cashing it funds the opponent's other takes.
    value += sign * pot.count * (safe ? 66 : 18);
    if (state.scores[pot.owner] + pot.count >= 25) value += sign * (state.turn === pot.owner ? 9000 : safe ? 6500 : 400);
  }
  return value;
}

function orderedChildren(state, player, maximizing) {
  return legalActions(state).map(action => {
    const next = applyAction(state, action);
    return { action, next, value: evaluate(next, player) };
  }).sort((a, b) => maximizing ? b.value - a.value : a.value - b.value);
}

/** Bounded iterative-deepening search; a limited opponent, not a solved-game AI. */
export function chooseAction(state, options = {}) {
  if (!validateState(state)) throw new TypeError('Invalid game state.');
  const actions = legalActions(state);
  if (!actions.length) return null;
  if (actions.length === 1) return actions[0];
  const immediate = winningCollect(state);
  if (immediate) return immediate;
  const thoughtful = options.difficulty !== 'casual';
  const timeMs = Math.min(800, Math.max(1, options.timeMs ?? (thoughtful ? 350 : 35)));
  const maxNodes = Math.min(2_000_000, Math.max(1, options.maxNodes ?? (thoughtful ? 1_000_000 : 5_000)));
  const maxDepth = Math.min(24, Math.max(1, options.maxDepth ?? (thoughtful ? 24 : 6)));
  const deadline = performance.now() + timeMs;
  const player = state.turn;
  let nodes = 0;
  const interrupted = Symbol('search budget');
  let children = orderedChildren(state, player, true);
  // Never knowingly allow a one-move loss when at least one safe move exists.
  const safe = children.filter(child => child.next.winner === player || !winningCollect(child.next));
  if (safe.length) children = safe;
  let best = children[0].action;

  function search(position, depth, alpha, beta) {
    nodes += 1;
    if (nodes > maxNodes || (nodes % 64 === 0 && performance.now() >= deadline)) throw interrupted;
    if (!depth || position.winner !== null) return evaluate(position, player);
    const maximizing = position.turn === player;
    let value = maximizing ? -Infinity : Infinity;
    for (const child of orderedChildren(position, player, maximizing)) {
      const score = search(child.next, depth - 1, alpha, beta);
      value = maximizing ? Math.max(value, score) : Math.min(value, score);
      if (maximizing) alpha = Math.max(alpha, value);
      else beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return value;
  }

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    let candidate = best;
    let value = -Infinity;
    const scored = [];
    try {
      for (const child of children) {
        const score = search(child.next, depth - 1, value, Infinity);
        scored.push({ ...child, value: score });
        if (score > value) { value = score; candidate = child.action; }
      }
    } catch (error) {
      if (error !== interrupted) throw error;
      break;
    }
    best = candidate;
    children = scored.sort((a, b) => b.value - a.value);
    if (value >= WIN || performance.now() >= deadline) break;
  }
  return best;
}
