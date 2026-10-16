import { chooseAction } from './bot.js';

self.onmessage = ({ data }) => {
  const { id, state, difficulty } = data ?? {};
  try {
    self.postMessage({ id, action: chooseAction(state, { difficulty }) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Bot search failed.' });
  }
};
