// Drop-in replacement for Claude artifact's window.storage API
// Uses localStorage under the hood — works in any standard browser/PWA context.

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
      localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      throw e;
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(key);
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
