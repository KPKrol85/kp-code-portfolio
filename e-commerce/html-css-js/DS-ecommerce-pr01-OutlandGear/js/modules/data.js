const cache = new Map();

export const fetchJson = async (path, fallback = null) => {
  if (typeof path !== "string" || !path.trim()) {
    return fallback;
  }

  if (cache.has(path)) {
    return cache.get(path);
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  const data = await response.json();
  cache.set(path, data);
  return data;
};
