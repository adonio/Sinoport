import { useState, useEffect, useCallback } from 'react';

// ==============================|| LOCAL STORAGE HOOKS ||============================== //

export function useLocalStorage(key, defaultValue) {
  // Load initial state from localStorage or fallback to default
  const readValue = () => {
    if (typeof window === 'undefined') return defaultValue;

    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (err) {
      console.warn(`Error reading localStorage key “${key}”:`, err);
      return defaultValue;
    }
  };

  const [state, setState] = useState(readValue);

  // Sync to localStorage whenever state changes
  useEffect(() => {
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(key, serialized);
      window.dispatchEvent(new CustomEvent('local-storage', { detail: { key, value: serialized } }));
    } catch (err) {
      console.warn(`Error setting localStorage key “${key}”:`, err);
    }
  }, [key, state]);

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.type === 'storage' && event.key && event.key !== key) return;
      if (event.type === 'local-storage' && event.detail?.key !== key) return;

      const nextValue =
        event.type === 'local-storage' && typeof event.detail?.value === 'string' ? JSON.parse(event.detail.value) : readValue();

      setState((prev) => (JSON.stringify(prev) === JSON.stringify(nextValue) ? prev : nextValue));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
    };
  }, [key]);

  // Update single field
  const setField = useCallback((key, value) => {
    setState((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Reset to defaults
  const resetState = useCallback(() => {
    setState(defaultValue);
    const serialized = JSON.stringify(defaultValue);
    localStorage.setItem(key, serialized);
    window.dispatchEvent(new CustomEvent('local-storage', { detail: { key, value: serialized } }));
  }, [defaultValue, key]);

  return { state, setState, setField, resetState };
}
