const Storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (e) {
      console.warn('Storage get error', e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage set error', e);
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { console.warn(e); }
  },
  clear() { try { localStorage.clear(); } catch (e) { console.warn(e); }
  }
};

export { Storage as FleetStorage };
