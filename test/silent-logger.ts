import type { Logger } from '../src/lib/logger.js';

export const silentLogger: Logger = {
  info() {},
  error() {},
};
