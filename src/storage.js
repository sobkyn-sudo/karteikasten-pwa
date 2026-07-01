// Drop-in replacement for Claude artifact's window.storage API
// Uses localStorage under the hood — works in any standard browser/PWA context.

import { markChanged } from './sync.js';

export const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) throw new Error(`Key not found: ${key}`);
      return { key, value };
    } catch (e) {
      throw e;
    }
  },

  async set(key, value) {
    try {
      // Only mark as changed if the value actually differs — otherwise a
      // component simply re-rendering (e.g. on every page load) would bump
      // the sync timestamp with nothing to show for it, which is what was
      // driving two open tabs into a reload ping-pong.
      const isRealChange = localStorage.getItem(key) !== value;
      localStorage.setItem(key, value);
      if (isRealChange) markChanged(key);
      return { key, value };
    } catch (e) {
      throw e;
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(key);
      markChanged(key);
      return { key, deleted: true };
    } catch (e) {
      throw e;
    }
  },

  async list(prefix = '') {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
      return { keys, prefix };
    } catch (e) {
      throw e;
    }
  },
};
