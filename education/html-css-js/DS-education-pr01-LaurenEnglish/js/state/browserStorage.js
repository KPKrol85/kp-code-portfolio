const memoryValues = new Map();

const getBrowserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const readStoredValue = (key) => {
  const storageKey = String(key);

  if (memoryValues.has(storageKey)) {
    return memoryValues.get(storageKey);
  }

  const storage = getBrowserStorage();
  if (!storage) return null;

  try {
    const value = storage.getItem(storageKey);
    if (value !== null) {
      memoryValues.set(storageKey, value);
    }
    return value;
  } catch {
    return null;
  }
};

export const writeStoredValue = (key, value) => {
  const storageKey = String(key);
  const storedValue = String(value);
  memoryValues.set(storageKey, storedValue);

  const storage = getBrowserStorage();
  if (!storage) return false;

  try {
    storage.setItem(storageKey, storedValue);
    return true;
  } catch {
    return false;
  }
};

export const removeStoredValue = (key) => {
  const storageKey = String(key);
  memoryValues.set(storageKey, null);

  const storage = getBrowserStorage();
  if (!storage) return false;

  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
};
