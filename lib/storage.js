export function loadJson(key, fallbackValue) {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function saveJson(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
